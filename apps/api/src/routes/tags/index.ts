import { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { createTagBody, updateTagBody } from './schemas'

export const tagRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /api/v1/tags ──────────────────────────────────────────────────────
  // Retourne les tags système (cabinet_id=null) + les tags du cabinet
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const tags = await prisma.tag.findMany({
      where: {
        OR: [
          { cabinetId: null, isSystem: true },
          { cabinetId: request.cabinetId },
        ],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    })
    return reply.send({ data: { tags } })
  })

  // ── POST /api/v1/tags ─────────────────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createTagBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { name, color } = result.data

    // Vérifie l'unicité au sein du cabinet
    const existing = await prisma.tag.findFirst({
      where: { cabinetId: request.cabinetId, name },
    })
    if (existing) {
      return reply.status(409).send({ error: 'Un tag avec ce nom existe déjà', code: 'DUPLICATE_TAG' })
    }

    const tag = await prisma.tag.create({
      data: { cabinetId: request.cabinetId, name, color: color ?? null },
    })

    return reply.status(201).send({ data: { tag } })
  })

  // ── PATCH /api/v1/tags/:id ────────────────────────────────────────────────
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.tag.findFirst({
      where: { id, cabinetId: request.cabinetId },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Tag introuvable', code: 'NOT_FOUND' })
    }
    if (existing.isSystem) {
      return reply.status(403).send({ error: 'Les tags système ne peuvent pas être modifiés', code: 'SYSTEM_TAG' })
    }

    const result = updateTagBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const tag = await prisma.tag.update({ where: { id }, data: result.data })

    return reply.send({ data: { tag } })
  })

  // ── DELETE /api/v1/tags/:id ───────────────────────────────────────────────
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.tag.findFirst({
      where: { id, cabinetId: request.cabinetId },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Tag introuvable', code: 'NOT_FOUND' })
    }
    if (existing.isSystem) {
      return reply.status(403).send({ error: 'Les tags système ne peuvent pas être supprimés', code: 'SYSTEM_TAG' })
    }

    await prisma.tag.delete({ where: { id } })

    return reply.status(204).send()
  })
}
