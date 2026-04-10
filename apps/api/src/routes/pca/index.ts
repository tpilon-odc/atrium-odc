import { FastifyPluginAsync } from 'fastify'
import { MemberRole } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'

type DiffEntry = { old: unknown; new: unknown }

function computeFlatDiff(oldData: Record<string, unknown>, newData: Record<string, unknown>): Record<string, DiffEntry> {
  const diff: Record<string, DiffEntry> = {}
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])

  for (const key of allKeys) {
    const oldVal = oldData[key]
    const newVal = newData[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { old: oldVal, new: newVal }
    }
  }

  return diff
}

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

    // Fetch current PCA data before updating
    const existing = await prisma.cabinetPca.findUnique({ where: { cabinetId } })
    const oldData = (existing?.data ?? {}) as Record<string, unknown>
    const newData = body.data

    // Compute flat diff of changed fields
    const diff = computeFlatDiff(oldData, newData)

    const pca = await prisma.cabinetPca.upsert({
      where: { cabinetId },
      create: { cabinetId, data: body.data as object },
      update: { data: body.data as object },
    })

    // Only save history if something actually changed
    if (Object.keys(diff).length > 0) {
      await prisma.cabinetPcaHistory.create({
        data: {
          cabinetId: request.cabinetId,
          data: diff as object,
          savedBy: request.user.id,
        },
      })

      // Keep only last 50 entries
      const entries = await prisma.cabinetPcaHistory.findMany({
        where: { cabinetId: request.cabinetId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      if (entries.length > 50) {
        const toDelete = entries.slice(50).map(e => e.id)
        await prisma.cabinetPcaHistory.deleteMany({ where: { id: { in: toDelete } } })
      }
    }

    return reply.send({ data: { pca } })
  })

  // ── GET /api/v1/pca/history ───────────────────────────────────────────────
  // Retourne les 20 dernières versions sauvegardées du PCA
  app.get('/history', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const history = await prisma.cabinetPcaHistory.findMany({
      where: { cabinetId: request.cabinetId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        savedBy: true,
        data: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })
    return reply.send({ data: { history } })
  })

  // ── GET /api/v1/pca/history/:id ──────────────────────────────────────────
  // Retourne les données d'une version spécifique
  app.get('/history/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const entry = await prisma.cabinetPcaHistory.findFirst({
      where: { id, cabinetId: request.cabinetId },
      select: { id: true, data: true, createdAt: true, user: { select: { firstName: true, lastName: true, email: true } } },
    })
    if (!entry) return reply.status(404).send({ error: 'Version introuvable', code: 'NOT_FOUND' })
    return reply.send({ data: { entry } })
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
