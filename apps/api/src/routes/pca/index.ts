import { FastifyPluginAsync } from 'fastify'
import { MemberRole } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'

// Vérifie que l'utilisateur est owner ou admin du cabinet courant
async function requireOwnerOrAdmin(userId: string, cabinetId: string) {
  const member = await prisma.cabinetMember.findFirst({
    where: { userId, cabinetId, deletedAt: null, role: { in: [MemberRole.owner, MemberRole.admin] } },
  })
  return !!member
}

export const pcaRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/v1/pca ───────────────────────────────────────────────────────
  // Récupère le PCA du cabinet courant (crée un PCA vide si inexistant)
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const cabinetId = request.cabinetId

    let pca = await prisma.cabinetPca.findUnique({ where: { cabinetId } })

    if (!pca) {
      pca = await prisma.cabinetPca.create({
        data: { cabinetId, data: {} },
      })
    }

    return reply.send({ data: { pca } })
  })

  // ── PUT /api/v1/pca ───────────────────────────────────────────────────────
  // Sauvegarde les données du PCA (owner/admin uniquement)
  app.put('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const cabinetId = request.cabinetId
    const allowed = await requireOwnerOrAdmin(request.user.id, cabinetId)
    if (!allowed) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const body = request.body as { data: Record<string, unknown> }
    if (!body?.data || typeof body.data !== 'object') {
      return reply.status(400).send({ error: 'Données invalides', code: 'VALIDATION_ERROR' })
    }

    const pca = await prisma.cabinetPca.upsert({
      where: { cabinetId },
      create: { cabinetId, data: body.data },
      update: { data: body.data },
    })

    return reply.send({ data: { pca } })
  })

  // ── POST /api/v1/pca/complete ─────────────────────────────────────────────
  // Marque le PCA comme complété (owner/admin uniquement)
  app.post('/complete', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const cabinetId = request.cabinetId
    const allowed = await requireOwnerOrAdmin(request.user.id, cabinetId)
    if (!allowed) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const body = request.body as { completed: boolean }

    const pca = await prisma.cabinetPca.upsert({
      where: { cabinetId },
      create: { cabinetId, data: {}, isCompleted: true, completedAt: new Date() },
      update: {
        isCompleted: body?.completed !== false,
        completedAt: body?.completed !== false ? new Date() : null,
      },
    })

    return reply.send({ data: { pca } })
  })
}
