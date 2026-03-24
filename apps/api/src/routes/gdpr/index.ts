import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { GdprRequestType } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { consentMiddleware } from '../../middleware/consent'
import { prisma } from '../../lib/prisma'
import { sendGdprRequestAdminEmail } from '../../lib/mailer'

const createRequestBody = z.object({
  type: z.nativeEnum(GdprRequestType),
  message: z.string().max(2000).optional(),
})

export const gdprRoutes: FastifyPluginAsync = async (app) => {

  const preHandler = [authMiddleware, cabinetMiddleware, consentMiddleware]

  // ── POST /api/v1/gdpr/requests ────────────────────────────────────────────
  // Le cabinet soumet une demande RGPD (ACCESS ou ERASURE).
  // Une seule demande PENDING ou PROCESSING autorisée par type.
  app.post('/requests', { preHandler }, async (request, reply) => {
    const body = createRequestBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Données invalides', code: 'VALIDATION_ERROR' })
    }

    const { type, message } = body.data
    const cabinetId = request.cabinetId
    const requestedBy = request.user.id

    // Vérifier qu'il n'y a pas déjà une demande active du même type
    const existing = await prisma.gdprRequest.findFirst({
      where: {
        cabinetId,
        type,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    })

    if (existing) {
      return reply.status(409).send({
        error: 'Une demande de ce type est déjà en cours de traitement',
        code: 'REQUEST_ALREADY_PENDING',
      })
    }

    const gdprRequest = await prisma.gdprRequest.create({
      data: { cabinetId, requestedBy, type, message },
    })

    // Notification email à l'admin RGPD (non bloquant)
    const cabinet = await prisma.cabinet.findUnique({
      where: { id: cabinetId },
      select: { name: true },
    })

    sendGdprRequestAdminEmail({
      cabinetName: cabinet?.name ?? cabinetId,
      cabinetId,
      type,
      message,
      requestId: gdprRequest.id,
    }).catch(() => { /* non bloquant */ })

    return reply.status(201).send({ data: gdprRequest })
  })

  // ── GET /api/v1/gdpr/requests ─────────────────────────────────────────────
  // Liste les demandes RGPD du cabinet.
  app.get('/requests', { preHandler }, async (request, reply) => {
    const requests = await prisma.gdprRequest.findMany({
      where: { cabinetId: request.cabinetId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        message: true,
        response: true,
        exportPath: true,
        createdAt: true,
        processedAt: true,
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    return reply.send({ data: requests })
  })
}
