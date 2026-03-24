import { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { createFolderBody, updateFolderBody } from './schemas'

export const folderRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /api/v1/folders ───────────────────────────────────────────────────
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const folders = await prisma.folder.findMany({
      where: { cabinetId: request.cabinetId },
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    })
    return reply.send({ data: { folders } })
  })

  // ── POST /api/v1/folders ──────────────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createFolderBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { name, parentId, order } = result.data

    // Vérifie que le parent appartient bien au même cabinet
    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: parentId, cabinetId: request.cabinetId },
      })
      if (!parent) {
        return reply.status(404).send({ error: 'Dossier parent introuvable', code: 'NOT_FOUND' })
      }
    }

    const folder = await prisma.folder.create({
      data: { cabinetId: request.cabinetId, name, parentId: parentId ?? null, order },
    })

    return reply.status(201).send({ data: { folder } })
  })

  // ── PATCH /api/v1/folders/:id ─────────────────────────────────────────────
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.folder.findFirst({
      where: { id, cabinetId: request.cabinetId },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Dossier introuvable', code: 'NOT_FOUND' })
    }
    if (existing.isSystem) {
      return reply.status(403).send({ error: 'Les dossiers système ne peuvent pas être modifiés', code: 'SYSTEM_FOLDER' })
    }

    const result = updateFolderBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    // Vérifie que le nouveau parent (si fourni) appartient au cabinet et n'est pas le dossier lui-même
    if (result.data.parentId) {
      if (result.data.parentId === id) {
        return reply.status(400).send({ error: 'Un dossier ne peut pas être son propre parent', code: 'INVALID_PARENT' })
      }
      const parent = await prisma.folder.findFirst({
        where: { id: result.data.parentId, cabinetId: request.cabinetId },
      })
      if (!parent) {
        return reply.status(404).send({ error: 'Dossier parent introuvable', code: 'NOT_FOUND' })
      }
    }

    const folder = await prisma.folder.update({
      where: { id },
      data: result.data,
    })

    return reply.send({ data: { folder } })
  })

  // ── DELETE /api/v1/folders/:id ────────────────────────────────────────────
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.folder.findFirst({
      where: { id, cabinetId: request.cabinetId },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Dossier introuvable', code: 'NOT_FOUND' })
    }
    if (existing.isSystem) {
      return reply.status(403).send({ error: 'Les dossiers système ne peuvent pas être supprimés', code: 'SYSTEM_FOLDER' })
    }

    // Les sous-dossiers et documents sont cascadés par la DB (CASCADE / SET NULL)
    await prisma.folder.delete({ where: { id } })

    return reply.status(204).send()
  })

  // ── GET /api/v1/folders/:id/documents ─────────────────────────────────────
  app.get('/:id/documents', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const folder = await prisma.folder.findFirst({
      where: { id, cabinetId: request.cabinetId },
    })
    if (!folder) {
      return reply.status(404).send({ error: 'Dossier introuvable', code: 'NOT_FOUND' })
    }

    const documents = await prisma.document.findMany({
      where: { cabinetId: request.cabinetId, folderId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        tags: { include: { tag: true } },
      },
    })

    const data = documents.map((d) => ({
      ...d,
      sizeBytes: d.sizeBytes?.toString() ?? null,
    }))

    return reply.send({ data: { documents: data } })
  })
}
