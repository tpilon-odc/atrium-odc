import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { SubscriptionStatus } from '@cgp/db'
import { prisma } from '../../lib/prisma'

const activateBody = z.object({
  cabinetId: z.string().uuid('cabinetId invalide'),
  subscriptionStatus: z.enum(['active', 'trial', 'suspended', 'cancelled']).default('active'),
})

/**
 * Middleware de vérification du secret Odoo.
 * Odoo envoie le header `X-Odoo-Webhook-Secret` avec la valeur de ODOO_WEBHOOK_SECRET.
 */
function verifyOdooSecret(secret: string | undefined): boolean {
  const expected = process.env.ODOO_WEBHOOK_SECRET
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("Variable d'environnement manquante : ODOO_WEBHOOK_SECRET")
    }
    console.warn('[webhook] ODOO_WEBHOOK_SECRET non configuré — endpoint non sécurisé en dev')
    return true
  }
  return secret === expected
}

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /api/v1/webhooks/odoo/activate ───────────────────────────────────
  // Appelé par Odoo quand une souscription est confirmée/modifiée.
  // Met à jour subscription_status du cabinet.
  app.post('/odoo/activate', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const secret = request.headers['x-odoo-webhook-secret'] as string | undefined

    if (!verifyOdooSecret(secret)) {
      return reply.status(401).send({ error: 'Secret invalide', code: 'UNAUTHORIZED' })
    }

    const result = activateBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { cabinetId, subscriptionStatus } = result.data

    const cabinet = await prisma.cabinet.findUnique({ where: { id: cabinetId } })
    if (!cabinet) {
      return reply.status(404).send({ error: 'Cabinet introuvable', code: 'NOT_FOUND' })
    }

    const updated = await prisma.cabinet.update({
      where: { id: cabinetId },
      data: { subscriptionStatus: subscriptionStatus as SubscriptionStatus },
      select: { id: true, name: true, subscriptionStatus: true },
    })

    app.log.info({ cabinetId, subscriptionStatus }, '[webhook] Cabinet mis à jour via Odoo')

    return reply.send({ data: { cabinet: updated } })
  })
}
