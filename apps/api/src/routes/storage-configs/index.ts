import { FastifyPluginAsync } from 'fastify'
import { StorageProvider } from '@cgp/db'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'

const createConfigBody = z.object({
  provider: z.enum(['aws', 'gdrive', 'sharepoint', 'other']),
  label: z.string().min(1, 'Le libellé est requis'),
  baseUrl: z.string().url('URL de base invalide'),
})

const updateConfigBody = createConfigBody.partial()

export const storageConfigRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/v1/storage-configs ───────────────────────────────────────────
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const configs = await prisma.cabinetStorageConfig.findMany({
      where: { cabinetId: request.cabinetId },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ data: { configs } })
  })

  // ── POST /api/v1/storage-configs ──────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createConfigBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const config = await prisma.cabinetStorageConfig.create({
      data: {
        cabinetId: request.cabinetId,
        provider: result.data.provider as StorageProvider,
        label: result.data.label,
        baseUrl: result.data.baseUrl,
      },
    })

    return reply.status(201).send({ data: { config } })
  })

  // ── PATCH /api/v1/storage-configs/:id ────────────────────────────────────
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = updateConfigBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.cabinetStorageConfig.findFirst({
      where: { id, cabinetId: request.cabinetId },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Config introuvable', code: 'NOT_FOUND' })
    }

    const config = await prisma.cabinetStorageConfig.update({
      where: { id },
      data: { ...result.data, ...(result.data.provider ? { provider: result.data.provider as StorageProvider } : {}) },
    })

    return reply.send({ data: { config } })
  })

  // ── DELETE /api/v1/storage-configs/:id ───────────────────────────────────
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.cabinetStorageConfig.findFirst({
      where: { id, cabinetId: request.cabinetId },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Config introuvable', code: 'NOT_FOUND' })
    }

    await prisma.cabinetStorageConfig.delete({ where: { id } })
    return reply.status(204).send()
  })
}
