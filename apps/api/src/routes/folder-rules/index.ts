import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { MemberRole } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'

const ALLOWED_ENTITY_TYPES = ['contact', 'supplier', 'product', 'training', 'compliance_answer'] as const
type EntityType = typeof ALLOWED_ENTITY_TYPES[number]

const upsertRuleBody = z.object({
  entityType: z.enum(ALLOWED_ENTITY_TYPES),
  folderId: z.string().uuid(),
})

async function requireAdminOrOwner(
  request: Parameters<typeof authMiddleware>[0],
  reply: Parameters<typeof authMiddleware>[1]
) {
  const member = await prisma.cabinetMember.findFirst({
    where: { userId: request.user.id, cabinetId: request.cabinetId, deletedAt: null },
  })
  if (!member || !([MemberRole.owner, MemberRole.admin] as string[]).includes(member.role)) {
    return reply.status(403).send({ error: 'Droits insuffisants', code: 'FORBIDDEN' })
  }
}

export const folderRulesRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/v1/folder-rules ─────────────────────────────────────────────
  // Retourne toutes les règles du cabinet
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const rules = await prisma.folderRule.findMany({
      where: { cabinetId: request.cabinetId },
      include: { folder: { select: { id: true, name: true, parentId: true, isSystem: true } } },
      orderBy: { entityType: 'asc' },
    })
    return reply.send({ data: { rules } })
  })

  // ── PUT /api/v1/folder-rules ─────────────────────────────────────────────
  // Crée ou met à jour la règle pour un entityType (upsert)
  app.put('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    await requireAdminOrOwner(request, reply)
    if (reply.sent) return

    const result = upsertRuleBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { entityType, folderId } = result.data

    // Vérifie que le dossier appartient bien au cabinet
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, cabinetId: request.cabinetId },
    })
    if (!folder) {
      return reply.status(404).send({ error: 'Dossier introuvable', code: 'NOT_FOUND' })
    }

    const rule = await prisma.folderRule.upsert({
      where: { cabinetId_entityType: { cabinetId: request.cabinetId, entityType } },
      create: { cabinetId: request.cabinetId, entityType, folderId },
      update: { folderId },
      include: { folder: { select: { id: true, name: true, parentId: true, isSystem: true } } },
    })

    return reply.send({ data: { rule } })
  })

  // ── DELETE /api/v1/folder-rules/:entityType ──────────────────────────────
  // Supprime la règle pour un entityType
  app.delete('/:entityType', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    await requireAdminOrOwner(request, reply)
    if (reply.sent) return

    const { entityType } = request.params as { entityType: string }
    if (!(ALLOWED_ENTITY_TYPES as readonly string[]).includes(entityType)) {
      return reply.status(400).send({ error: 'Type invalide', code: 'VALIDATION_ERROR' })
    }

    await prisma.folderRule.deleteMany({
      where: { cabinetId: request.cabinetId, entityType: entityType as EntityType },
    })

    return reply.status(204).send()
  })
}
