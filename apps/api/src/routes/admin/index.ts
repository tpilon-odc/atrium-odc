import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { GlobalRole, GdprRequestStatus } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { updateReportBody } from '../clusters/schemas'
import { sendGdprRequestConfirmEmail } from '../../lib/mailer'
import { minioNative, BUCKET } from '../../lib/minio'

async function platformAdminMiddleware(request: Parameters<typeof authMiddleware>[0], reply: Parameters<typeof authMiddleware>[1]) {
  if (request.user?.globalRole !== GlobalRole.platform_admin) {
    return reply.status(403).send({ error: 'Réservé aux administrateurs de la plateforme', code: 'FORBIDDEN' })
  }
}

export const adminRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /api/v1/admin/reports ─────────────────────────────────────────────
  app.get('/reports', { preHandler: [authMiddleware, cabinetMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { status = 'PENDING' } = request.query as { status?: string }

    const reports = await prisma.messageReport.findMany({
      where: { status: status as 'PENDING' | 'REVIEWED' | 'DISMISSED' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
        message: {
          select: {
            id: true,
            content: true,
            deletedAt: true,
            createdAt: true,
            authorUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            authorCabinet: { select: { id: true, name: true } },
            channel: {
              select: {
                id: true,
                name: true,
                cluster: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    return reply.send({ data: { reports } })
  })

  // ── PATCH /api/v1/admin/reports/:id ───────────────────────────────────────
  // REVIEWED → supprime le message signalé · DISMISSED → ignore
  app.patch('/reports/:id', { preHandler: [authMiddleware, cabinetMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const report = await prisma.messageReport.findUnique({
      where: { id },
      select: { id: true, messageId: true, status: true },
    })
    if (!report) {
      return reply.status(404).send({ error: 'Signalement introuvable', code: 'NOT_FOUND' })
    }
    if (report.status !== 'PENDING') {
      return reply.status(409).send({ error: 'Ce signalement a déjà été traité', code: 'ALREADY_RESOLVED' })
    }

    const result = updateReportBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { status } = result.data

    await prisma.$transaction(async (tx) => {
      await tx.messageReport.update({ where: { id }, data: { status } })

      // Si REVIEWED → soft delete du message
      if (status === 'REVIEWED') {
        await tx.message.update({
          where: { id: report.messageId },
          data: { deletedAt: new Date() },
        })
        // Ferme tous les autres signalements en attente sur le même message
        await tx.messageReport.updateMany({
          where: { messageId: report.messageId, status: 'PENDING' },
          data: { status: 'REVIEWED' },
        })
      }
    })

    return reply.send({ data: { status } })
  })

  // ── GET /api/v1/admin/gdpr/requests ──────────────────────────────────────
  // Toutes les demandes RGPD — filtrable par status (défaut: PENDING)
  app.get('/gdpr/requests', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { status } = request.query as { status?: string }

    const where = status
      ? { status: status as GdprRequestStatus }
      : { status: { in: ['PENDING', 'PROCESSING'] as GdprRequestStatus[] } }

    const requests = await prisma.gdprRequest.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        status: true,
        message: true,
        response: true,
        exportPath: true,
        createdAt: true,
        processedAt: true,
        cabinet: { select: { id: true, name: true } },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        processor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    return reply.send({ data: requests })
  })

  // ── PATCH /api/v1/admin/gdpr/requests/:id ─────────────────────────────────
  // Traiter une demande RGPD : DONE ou REJECTED
  app.patch('/gdpr/requests/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const bodySchema = z.object({
      status: z.enum(['PROCESSING', 'DONE', 'REJECTED']),
      response: z.string().max(2000).optional(),
    })
    const result = bodySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'Données invalides', code: 'VALIDATION_ERROR' })
    }

    const gdprRequest = await prisma.gdprRequest.findUnique({
      where: { id },
      include: {
        cabinet: { select: { id: true, name: true } },
        requester: { select: { email: true } },
      },
    })
    if (!gdprRequest) {
      return reply.status(404).send({ error: 'Demande introuvable', code: 'NOT_FOUND' })
    }
    if (gdprRequest.status === 'DONE' || gdprRequest.status === 'REJECTED') {
      return reply.status(409).send({ error: 'Cette demande a déjà été traitée', code: 'ALREADY_RESOLVED' })
    }

    const { status, response } = result.data

    const updated = await prisma.gdprRequest.update({
      where: { id },
      data: {
        status,
        response,
        processedBy: request.user.id,
        processedAt: status === 'DONE' || status === 'REJECTED' ? new Date() : undefined,
      },
    })

    // Si DONE → générer lien de téléchargement si un export_path existe
    let downloadUrl: string | null = null
    if (status === 'DONE' && updated.exportPath) {
      try {
        downloadUrl = await minioNative.presignedGetObject(
          BUCKET,
          updated.exportPath,
          7 * 24 * 60 * 60 // 7 jours
        )
      } catch { /* non bloquant */ }
    }

    // Notification email au cabinet (non bloquant)
    if (status === 'DONE' || status === 'REJECTED') {
      sendGdprRequestConfirmEmail({
        to: gdprRequest.requester.email,
        cabinetName: gdprRequest.cabinet.name,
        type: gdprRequest.type,
        status,
        response,
        downloadUrl,
      }).catch(() => { /* non bloquant */ })
    }

    return reply.send({ data: updated })
  })
}
