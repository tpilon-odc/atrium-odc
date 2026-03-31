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
  categoryId: z.string().uuid().nullable().optional(),
  defaultHours: z.number().positive().optional(),
})

const updateCatalogBody = createCatalogBody.partial()

const categoryHoursSchema = z.array(z.object({
  categoryId: z.string().uuid(),
  hours: z.number().positive(),
})).optional()

const createTrainingBody = z.object({
  userId: z.string().uuid('userId invalide').optional(),
  memberId: z.string().uuid('memberId invalide').optional(),
  trainingId: z.string().uuid('trainingId invalide'),
  trainingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  trainingDateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)').optional(),
  hoursCompleted: z.number().positive().optional(),
  categoryHours: categoryHoursSchema,
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
  // CATÉGORIES (paramétrables admin)
  // ══════════════════════════════════════════════════════════════════════════

  // ── GET /api/v1/trainings/categories ─────────────────────────────────────
  app.get('/categories', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const categories = await prisma.trainingCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })
    return reply.send({ data: { categories } })
  })

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
      include: { trainingCategory: { select: { id: true, name: true, code: true } } },
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
        training: { include: { trainingCategory: { select: { id: true, name: true, code: true } } } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        member: { select: { id: true, externalFirstName: true, externalLastName: true, externalEmail: true } },
        certificate: { select: { id: true, name: true, mimeType: true } },
        categoryHours: { include: { category: { select: { id: true, name: true, code: true } } } },
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

    if (!result.data.userId && !result.data.memberId) {
      return reply.status(400).send({ error: 'userId ou memberId requis', code: 'VALIDATION_ERROR' })
    }

    const includeShape = {
      training: { include: { trainingCategory: { select: { id: true, name: true, code: true } } } },
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
      member: { select: { id: true, externalFirstName: true, externalLastName: true, externalEmail: true } },
      certificate: { select: { id: true, name: true, mimeType: true } },
      categoryHours: { include: { category: { select: { id: true, name: true, code: true } } } },
    } as const

    const training = await prisma.$transaction(async (tx) => {
      const record = await tx.collaboratorTraining.create({
        data: {
          cabinetId: request.cabinetId,
          userId: result.data.userId,
          memberId: result.data.memberId,
          trainingId: result.data.trainingId,
          trainingDate: new Date(result.data.trainingDate),
          trainingDateEnd: result.data.trainingDateEnd ? new Date(result.data.trainingDateEnd) : undefined,
          hoursCompleted: result.data.hoursCompleted,
          certificateDocumentId: result.data.certificateDocumentId,
          notes: result.data.notes,
        },
      })
      if (result.data.categoryHours?.length) {
        await tx.collaboratorTrainingHours.createMany({
          data: result.data.categoryHours.map((ch) => ({
            trainingRecordId: record.id,
            categoryId: ch.categoryId,
            hours: ch.hours,
          })),
        })
      }
      return tx.collaboratorTraining.findUniqueOrThrow({ where: { id: record.id }, include: includeShape })
    })

    // Si une attestation est jointe, ajouter le tag système "Attestation de formation"
    if (result.data.certificateDocumentId) {
      const tagName = 'Attestation de formation'
      let tag = await prisma.tag.findFirst({ where: { isSystem: true, name: tagName } })
      if (!tag) {
        tag = await prisma.tag.create({ data: { name: tagName, isSystem: true, cabinetId: null } })
      }
      // Ajouter le tag s'il n'est pas déjà présent
      await prisma.documentTag.upsert({
        where: { documentId_tagId: { documentId: result.data.certificateDocumentId, tagId: tag.id } },
        create: { documentId: result.data.certificateDocumentId, tagId: tag.id },
        update: {},
      })
    }

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

    const includeShape = {
      training: { include: { trainingCategory: { select: { id: true, name: true, code: true } } } },
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
      member: { select: { id: true, externalFirstName: true, externalLastName: true, externalEmail: true } },
      certificate: { select: { id: true, name: true, mimeType: true } },
      categoryHours: { include: { category: { select: { id: true, name: true, code: true } } } },
    } as const

    const training = await prisma.$transaction(async (tx) => {
      await tx.collaboratorTraining.update({
        where: { id },
        data: {
          ...(result.data.trainingDate ? { trainingDate: new Date(result.data.trainingDate) } : {}),
          ...(result.data.trainingDateEnd !== undefined ? { trainingDateEnd: result.data.trainingDateEnd ? new Date(result.data.trainingDateEnd) : null } : {}),
          ...(result.data.hoursCompleted !== undefined ? { hoursCompleted: result.data.hoursCompleted } : {}),
          ...(result.data.certificateDocumentId !== undefined ? { certificateDocumentId: result.data.certificateDocumentId } : {}),
          ...(result.data.notes !== undefined ? { notes: result.data.notes } : {}),
        },
      })
      if (result.data.categoryHours !== undefined) {
        await tx.collaboratorTrainingHours.deleteMany({ where: { trainingRecordId: id } })
        if (result.data.categoryHours?.length) {
          await tx.collaboratorTrainingHours.createMany({
            data: result.data.categoryHours.map((ch) => ({
              trainingRecordId: id,
              categoryId: ch.categoryId,
              hours: ch.hours,
            })),
          })
        }
      }
      return tx.collaboratorTraining.findUniqueOrThrow({ where: { id }, include: includeShape })
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
