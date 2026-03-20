import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ShareEntityType } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'

const createShareBody = z.object({
  grantedTo: z.string().uuid('grantedTo invalide'),
  entityType: z.enum(['contact', 'document', 'collaborator_training', 'cabinet_compliance', 'cabinet']),
  entityId: z.string().uuid().optional(),
})

export const shareRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/v1/shares ────────────────────────────────────────────────────
  // Partages accordés par ce cabinet
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const shares = await prisma.share.findMany({
      where: { cabinetId: request.cabinetId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        recipientUser: { select: { id: true, email: true } },
      },
    })

    return reply.send({ data: { shares } })
  })

  // ── GET /api/v1/shares/received ───────────────────────────────────────────
  // Partages reçus par l'utilisateur connecté
  app.get('/received', { preHandler: [authMiddleware] }, async (request, reply) => {
    const shares = await prisma.share.findMany({
      where: { grantedTo: request.user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        granterUser: { select: { id: true, email: true } },
        cabinet: { select: { id: true, name: true } },
      },
    })

    return reply.send({ data: { shares } })
  })

  // ── POST /api/v1/shares ───────────────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createShareBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    // Vérifie que le destinataire existe
    const recipient = await prisma.user.findUnique({ where: { id: result.data.grantedTo } })
    if (!recipient) {
      return reply.status(404).send({ error: 'Utilisateur destinataire introuvable', code: 'NOT_FOUND' })
    }

    // Évite les doublons actifs
    const existing = await prisma.share.findFirst({
      where: {
        cabinetId: request.cabinetId,
        grantedTo: result.data.grantedTo,
        entityType: result.data.entityType as ShareEntityType,
        entityId: result.data.entityId ?? null,
        isActive: true,
      },
    })
    if (existing) {
      return reply.status(409).send({ error: 'Ce partage existe déjà', code: 'DUPLICATE' })
    }

    const share = await prisma.share.create({
      data: {
        cabinetId: request.cabinetId,
        grantedBy: request.user.id,
        grantedTo: result.data.grantedTo,
        entityType: result.data.entityType as ShareEntityType,
        entityId: result.data.entityId,
      },
      include: {
        recipientUser: { select: { id: true, email: true } },
      },
    })

    return reply.status(201).send({ data: { share } })
  })

  // ── DELETE /api/v1/shares/:id ─────────────────────────────────────────────
  // Révoque un partage
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.share.findFirst({
      where: { id, cabinetId: request.cabinetId, isActive: true },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Partage introuvable', code: 'NOT_FOUND' })
    }

    await prisma.share.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    })

    return reply.status(204).send()
  })
}
