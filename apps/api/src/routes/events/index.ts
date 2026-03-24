import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'

const eventSelect = {
  id: true,
  cabinetId: true,
  createdBy: true,
  contactId: true,
  title: true,
  description: true,
  type: true,
  status: true,
  startAt: true,
  endAt: true,
  allDay: true,
  location: true,
  complianceAnswerId: true,
  isRecurring: true,
  recurrenceRule: true,
  createdAt: true,
  updatedAt: true,
  contact: {
    select: { id: true, firstName: true, lastName: true, type: true },
  },
} as const

const createEventBody = z.object({
  title: z.string().min(1).max(255),
  type: z.enum(['RDV', 'CALL', 'TASK']),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  contactId: z.string().uuid().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  allDay: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().max(500).nullable().optional(),
  status: z.enum(['PLANNED', 'DONE', 'CANCELLED']).optional(),
})

const updateEventBody = createEventBody.partial()

const updateStatusBody = z.object({
  status: z.enum(['PLANNED', 'DONE', 'CANCELLED']),
})

export const eventRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/events?start=ISO&end=ISO&type=RDV,CALL,TASK,COMPLIANCE
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const query = request.query as { start?: string; end?: string; type?: string }

    const types = query.type
      ? (query.type.split(',') as Array<'RDV' | 'CALL' | 'TASK' | 'COMPLIANCE'>)
      : undefined

    const events = await prisma.event.findMany({
      where: {
        cabinetId: request.cabinetId,
        deletedAt: null,
        ...(query.start || query.end
          ? {
              startAt: {
                ...(query.start ? { gte: new Date(query.start) } : {}),
                ...(query.end ? { lte: new Date(query.end) } : {}),
              },
            }
          : {}),
        ...(types ? { type: { in: types } } : {}),
      },
      select: eventSelect,
      orderBy: { startAt: 'asc' },
    })

    return reply.send({ data: { events } })
  })

  // GET /api/v1/events/upcoming — doit être AVANT /:id
  app.get('/upcoming', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const events = await prisma.event.findMany({
      where: {
        cabinetId: request.cabinetId,
        deletedAt: null,
        startAt: { gte: new Date() },
        status: 'PLANNED',
      },
      select: eventSelect,
      orderBy: { startAt: 'asc' },
      take: 10,
    })

    return reply.send({ data: { events } })
  })

  // POST /api/v1/events
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createEventBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { startAt, endAt, ...rest } = result.data

    const start = new Date(startAt)
    const end = new Date(endAt)

    if (start >= end) {
      return reply.status(400).send({ error: 'La date de fin doit être après la date de début', code: 'INVALID_DATES' })
    }

    const event = await prisma.event.create({
      data: {
        ...rest,
        startAt: start,
        endAt: end,
        cabinetId: request.cabinetId,
        createdBy: request.user.id,
      },
      select: eventSelect,
    })

    return reply.status(201).send({ data: { event } })
  })

  // PATCH /api/v1/events/:id
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.event.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
      select: { type: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Événement introuvable', code: 'NOT_FOUND' })
    }

    if (existing.type === 'COMPLIANCE') {
      return reply.status(403).send({ error: 'Les événements de conformité ne peuvent pas être modifiés manuellement', code: 'COMPLIANCE_EVENT_READONLY' })
    }

    const result = updateEventBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { startAt, endAt, ...rest } = result.data

    const start = startAt ? new Date(startAt) : undefined
    const end = endAt ? new Date(endAt) : undefined

    if (start && end && start >= end) {
      return reply.status(400).send({ error: 'La date de fin doit être après la date de début', code: 'INVALID_DATES' })
    }

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...rest,
        ...(start ? { startAt: start } : {}),
        ...(end ? { endAt: end } : {}),
      },
      select: eventSelect,
    })

    return reply.send({ data: { event } })
  })

  // DELETE /api/v1/events/:id — soft delete
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.event.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
      select: { type: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Événement introuvable', code: 'NOT_FOUND' })
    }

    if (existing.type === 'COMPLIANCE') {
      return reply.status(403).send({ error: 'Les événements de conformité ne peuvent pas être supprimés manuellement', code: 'COMPLIANCE_EVENT_READONLY' })
    }

    await prisma.event.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return reply.status(204).send()
  })

  // PATCH /api/v1/events/:id/status
  app.patch('/:id/status', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.event.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Événement introuvable', code: 'NOT_FOUND' })
    }

    const result = updateStatusBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const event = await prisma.event.update({
      where: { id },
      data: { status: result.data.status },
      select: eventSelect,
    })

    return reply.send({ data: { event } })
  })
}
