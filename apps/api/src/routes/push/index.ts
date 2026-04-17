import { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'

export const pushRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /api/v1/push/subscribe ──────────────────────────────────────────
  app.post(
    '/subscribe',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { endpoint, keys } = request.body as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return reply.status(400).send({ error: 'Subscription invalide', code: 'BAD_REQUEST' })
      }

      await prisma.pushSubscription.upsert({
        where: { endpoint },
        update: { p256dh: keys.p256dh, auth: keys.auth, userId: request.user.id },
        create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: request.user.id },
      })

      return reply.status(201).send({ data: { message: 'Abonnement enregistré' } })
    }
  )

  // ── DELETE /api/v1/push/subscribe ────────────────────────────────────────
  app.delete(
    '/subscribe',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { endpoint } = request.body as { endpoint: string }

      if (!endpoint) {
        return reply.status(400).send({ error: 'Endpoint requis', code: 'BAD_REQUEST' })
      }

      await prisma.pushSubscription.deleteMany({
        where: { endpoint, userId: request.user.id },
      })

      return reply.send({ data: { message: 'Abonnement supprimé' } })
    }
  )
}
