import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { adminMiddleware } from '../../middleware/admin'
import { prisma } from '../../lib/prisma'

const createCatalogBody = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  organizer: z.string().optional(),
  category: z.string().optional(),
  defaultHours: z.number().positive().optional(),
})

const updateCatalogBody = createCatalogBody.partial()

const createTrainingBody = z.object({
  userId: z.string().uuid('userId invalide'),
  trainingId: z.string().uuid('trainingId invalide'),
  trainingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  hoursCompleted: z.number().positive().optional(),
  certificateDocumentId: z.string().uuid().optional(),
  notes: z.string().optional(),
})

const updateTrainingBody = createTrainingBody.omit({ userId: true, trainingId: true }).partial()

const listTrainingsQuery = z.object({
  userId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const trainingRoutes: FastifyPluginAsync = async (app) => {
  // ══════════════════════════════════════════════════════════════════════════
  // CATALOGUE (données communautaires)
  // ══════════════════════════════════════════════════════════════════════════

  // ── GET /api/v1/trainings/catalog ─────────────────────────────────────────
  app.get('/catalog', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { search } = request.query as { search?: string }

    const catalog = await prisma.trainingCatalog.findMany({
      where: {
        deletedAt: null,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    })

    return reply.send({ data: { catalog } })
  })

  // ── POST /api/v1/trainings/catalog ────────────────────────────────────────
  app.post('/catalog', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createCatalogBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const entry = await prisma.trainingCatalog.create({
      data: {
        ...result.data,
        createdBy: request.user.id,
      },
    })

    return reply.status(201).send({ data: { entry } })
  })

  // ── PATCH /api/v1/trainings/catalog/:id ───────────────────────────────────
  app.patch('/catalog/:id', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = updateCatalogBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.trainingCatalog.findFirst({ where: { id, deletedAt: null } })
    if (!existing) {
      return reply.status(404).send({ error: 'Formation catalogue introuvable', code: 'NOT_FOUND' })
    }

    const entry = await prisma.trainingCatalog.update({ where: { id }, data: result.data })
    return reply.send({ data: { entry } })
  })

  // ── DELETE /api/v1/trainings/catalog/:id ──────────────────────────────────
  app.delete('/catalog/:id', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.trainingCatalog.findFirst({ where: { id, deletedAt: null } })
    if (!existing) {
      return reply.status(404).send({ error: 'Formation catalogue introuvable', code: 'NOT_FOUND' })
    }

    await prisma.trainingCatalog.update({ where: { id }, data: { deletedAt: new Date() } })
    return reply.status(204).send()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // SUIVI COLLABORATEURS (données cabinet)
  // ══════════════════════════════════════════════════════════════════════════

  // ── GET /api/v1/trainings ─────────────────────────────────────────────────
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const query = listTrainingsQuery.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: query.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { userId, cursor, limit } = query.data

    const trainings = await prisma.collaboratorTraining.findMany({
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        cabinetId: request.cabinetId,
        deletedAt: null,
        ...(userId ? { userId } : {}),
      },
      orderBy: { trainingDate: 'desc' },
      include: {
        training: true,
        user: { select: { id: true, email: true } },
      },
    })

    const hasMore = trainings.length > limit
    const items = hasMore ? trainings.slice(0, limit) : trainings
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return reply.send({ data: { trainings: items, nextCursor, hasMore } })
  })

  // ── POST /api/v1/trainings ────────────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createTrainingBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    // Vérifie que la formation existe dans le catalogue
    const catalogEntry = await prisma.trainingCatalog.findFirst({
      where: { id: result.data.trainingId, deletedAt: null },
    })
    if (!catalogEntry) {
      return reply.status(404).send({ error: 'Formation catalogue introuvable', code: 'NOT_FOUND' })
    }

    const training = await prisma.collaboratorTraining.create({
      data: {
        cabinetId: request.cabinetId,
        userId: result.data.userId,
        trainingId: result.data.trainingId,
        trainingDate: new Date(result.data.trainingDate),
        hoursCompleted: result.data.hoursCompleted,
        certificateDocumentId: result.data.certificateDocumentId,
        notes: result.data.notes,
      },
      include: {
        training: true,
        user: { select: { id: true, email: true } },
      },
    })

    return reply.status(201).send({ data: { training } })
  })

  // ── PATCH /api/v1/trainings/:id ───────────────────────────────────────────
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = updateTrainingBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.collaboratorTraining.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Formation introuvable', code: 'NOT_FOUND' })
    }

    const training = await prisma.collaboratorTraining.update({
      where: { id },
      data: {
        ...(result.data.trainingDate ? { trainingDate: new Date(result.data.trainingDate) } : {}),
        ...(result.data.hoursCompleted !== undefined ? { hoursCompleted: result.data.hoursCompleted } : {}),
        ...(result.data.certificateDocumentId !== undefined ? { certificateDocumentId: result.data.certificateDocumentId } : {}),
        ...(result.data.notes !== undefined ? { notes: result.data.notes } : {}),
      },
      include: {
        training: true,
        user: { select: { id: true, email: true } },
      },
    })

    return reply.send({ data: { training } })
  })

  // ── DELETE /api/v1/trainings/:id ──────────────────────────────────────────
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.collaboratorTraining.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Formation introuvable', code: 'NOT_FOUND' })
    }

    await prisma.collaboratorTraining.update({ where: { id }, data: { deletedAt: new Date() } })
    return reply.status(204).send()
  })
}
