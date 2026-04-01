import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { MemberRole, FolderRuleTagType } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'

const ALLOWED_ENTITY_TYPES = ['contact', 'supplier', 'product', 'training', 'compliance_answer'] as const
type EntityType = typeof ALLOWED_ENTITY_TYPES[number]

const RULE_INCLUDE = {
  folder: { select: { id: true, name: true, parentId: true, isSystem: true } },
  tagRules: { orderBy: { order: 'asc' as const } },
}

const upsertRuleBody = z.object({
  entityType: z.enum(ALLOWED_ENTITY_TYPES),
  folderId: z.string().uuid(),
})

const tagRuleBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('fixed'), fixedValue: z.string().min(1), order: z.number().int().default(0) }),
  z.object({ type: z.literal('year'), order: z.number().int().default(0) }),
  z.object({ type: z.literal('entity_name'), order: z.number().int().default(0) }),
])

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
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const rules = await prisma.folderRule.findMany({
      where: { cabinetId: request.cabinetId },
      include: RULE_INCLUDE,
      orderBy: { entityType: 'asc' },
    })
    return reply.send({ data: { rules } })
  })

  // ── PUT /api/v1/folder-rules ─────────────────────────────────────────────
  app.put('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    await requireAdminOrOwner(request, reply)
    if (reply.sent) return

    const result = upsertRuleBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { entityType, folderId } = result.data

    const folder = await prisma.folder.findFirst({ where: { id: folderId, cabinetId: request.cabinetId } })
    if (!folder) {
      return reply.status(404).send({ error: 'Dossier introuvable', code: 'NOT_FOUND' })
    }

    const rule = await prisma.folderRule.upsert({
      where: { cabinetId_entityType: { cabinetId: request.cabinetId, entityType } },
      create: { cabinetId: request.cabinetId, entityType, folderId },
      update: { folderId },
      include: RULE_INCLUDE,
    })

    return reply.send({ data: { rule } })
  })

  // ── DELETE /api/v1/folder-rules/:entityType ──────────────────────────────
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

  // ── POST /api/v1/folder-rules/:entityType/tags ───────────────────────────
  // Ajoute un tag auto à la règle du contexte
  app.post('/:entityType/tags', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    await requireAdminOrOwner(request, reply)
    if (reply.sent) return

    const { entityType } = request.params as { entityType: string }
    if (!(ALLOWED_ENTITY_TYPES as readonly string[]).includes(entityType)) {
      return reply.status(400).send({ error: 'Type invalide', code: 'VALIDATION_ERROR' })
    }

    const result = tagRuleBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const rule = await prisma.folderRule.findUnique({
      where: { cabinetId_entityType: { cabinetId: request.cabinetId, entityType: entityType as EntityType } },
    })
    if (!rule) {
      return reply.status(404).send({ error: 'Règle introuvable — configurez d\'abord un dossier', code: 'NOT_FOUND' })
    }

    const tagRule = await prisma.folderRuleTag.create({
      data: {
        folderRuleId: rule.id,
        type: result.data.type as FolderRuleTagType,
        fixedValue: result.data.type === 'fixed' ? result.data.fixedValue : null,
        order: result.data.order,
      },
    })

    return reply.status(201).send({ data: { tagRule } })
  })

  // ── DELETE /api/v1/folder-rules/:entityType/tags/:tagRuleId ──────────────
  app.delete('/:entityType/tags/:tagRuleId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    await requireAdminOrOwner(request, reply)
    if (reply.sent) return

    const { entityType, tagRuleId } = request.params as { entityType: string; tagRuleId: string }

    const rule = await prisma.folderRule.findUnique({
      where: { cabinetId_entityType: { cabinetId: request.cabinetId, entityType: entityType as EntityType } },
    })
    if (!rule) {
      return reply.status(404).send({ error: 'Règle introuvable', code: 'NOT_FOUND' })
    }

    await prisma.folderRuleTag.deleteMany({
      where: { id: tagRuleId, folderRuleId: rule.id },
    })

    return reply.status(204).send()
  })
}
