import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'

const postConsentBody = z.object({
  version: z.string().min(1),
})

export const consentRoutes: FastifyPluginAsync = async (app) => {

  // ── POST /api/v1/consent ───────────────────────────────────────────────────
  // Enregistre l'acceptation des CGU pour l'utilisateur connecté.
  // Idempotent : si déjà accepté pour cette version, retourne l'existant.
  app.post('/', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = postConsentBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Données invalides', code: 'VALIDATION_ERROR' })
    }

    const { version } = body.data
    const userId = request.user.id

    // IP et user-agent depuis la requête
    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      request.ip ??
      null
    const userAgent = request.headers['user-agent'] ?? null

    // Idempotent — une seule entrée par (user, version)
    const existing = await prisma.consentRecord.findFirst({
      where: { userId, version },
    })

    if (existing) {
      return reply.status(200).send({ data: existing })
    }

    const record = await prisma.consentRecord.create({
      data: { userId, version, ipAddress, userAgent },
    })

    return reply.status(201).send({ data: record })
  })

  // ── GET /api/v1/consent ────────────────────────────────────────────────────
  // Historique complet des consentements de l'utilisateur connecté.
  app.get('/', { preHandler: [authMiddleware] }, async (request, reply) => {
    const records = await prisma.consentRecord.findMany({
      where: { userId: request.user.id },
      orderBy: { acceptedAt: 'desc' },
    })

    return reply.send({ data: records })
  })
}
