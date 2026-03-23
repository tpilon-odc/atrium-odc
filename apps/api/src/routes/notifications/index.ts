import { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { sendComplianceExpiryEmail } from '../../lib/mailer'

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /api/v1/notifications/test ──────────────────────────────────────
  // Crée une notification de test pour l'utilisateur connecté (dev uniquement)
  app.post(
    '/test',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      if (process.env.NODE_ENV !== 'development') {
        return reply.status(403).send({ error: 'Disponible en développement uniquement', code: 'FORBIDDEN' })
      }
      // Récupère la première phase disponible pour un lien valide
      const firstPhase = await prisma.compliancePhase.findFirst({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        select: { id: true, label: true },
      })

      const notification = await prisma.notification.create({
        data: {
          cabinetId: request.cabinetId,
          userId: request.user.id,
          type: 'compliance_expiring',
          title: 'Attestation RC Pro expire dans 7 jours',
          message: 'L\'item "Attestation RC Professionnelle" (Assurances & Garanties) expire le ' +
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR') + '. Pensez à le renouveler.',
          entityType: 'compliance_phase',
          entityId: firstPhase?.id ?? request.cabinetId,
        },
      })
      return reply.status(201).send({ data: { notification } })
    }
  )

  // ── POST /api/v1/notifications/test-email ────────────────────────────────
  // Envoie un email de test à l'utilisateur connecté (dev uniquement)
  app.post(
    '/test-email',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      if (process.env.NODE_ENV !== 'development') {
        return reply.status(403).send({ error: 'Disponible en développement uniquement', code: 'FORBIDDEN' })
      }
      await sendComplianceExpiryEmail({
        to: request.user.email,
        cabinetName: 'Cabinet Test',
        itemLabel: 'Attestation RC Professionnelle',
        phaseLabel: 'Assurances & Garanties',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        daysBefore: 7,
      })
      return reply.send({ data: { message: `Email envoyé à ${request.user.email}` } })
    }
  )

  // ── GET /api/v1/notifications ─────────────────────────────────────────────
  // Retourne les notifications de l'utilisateur connecté
  // ?all=true pour inclure les lues, sinon non lues uniquement
  // ?cursor=<id> pour la pagination
  app.get(
    '/',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { all, cursor } = request.query as { all?: string; cursor?: string }
      const onlyUnread = all !== 'true'

      const notifications = await prisma.notification.findMany({
        where: {
          userId: request.user.id,
          ...(onlyUnread ? { isRead: false } : {}),
          ...(cursor ? { createdAt: { lt: (await prisma.notification.findUnique({ where: { id: cursor }, select: { createdAt: true } }))?.createdAt } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      const unreadCount = await prisma.notification.count({
        where: { userId: request.user.id, isRead: false },
      })

      const nextCursor = notifications.length === 20 ? notifications[notifications.length - 1].id : null

      return reply.send({ data: { notifications, unreadCount, nextCursor } })
    }
  )

  // ── PATCH /api/v1/notifications/read-all ─────────────────────────────────
  // IMPORTANT : doit être enregistré AVANT /:id/read
  app.patch(
    '/read-all',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      await prisma.notification.updateMany({
        where: { userId: request.user.id, isRead: false },
        data: { isRead: true },
      })
      return reply.send({ data: { message: 'Toutes les notifications marquées comme lues' } })
    }
  )

  // ── PATCH /api/v1/notifications/:id/read ─────────────────────────────────
  app.patch(
    '/:id/read',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const notification = await prisma.notification.findFirst({
        where: { id, userId: request.user.id },
      })
      if (!notification) {
        return reply.status(404).send({ error: 'Notification introuvable', code: 'NOT_FOUND' })
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      })
      return reply.send({ data: { notification: updated } })
    }
  )
}
