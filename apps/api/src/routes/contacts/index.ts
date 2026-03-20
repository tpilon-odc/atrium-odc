import { FastifyPluginAsync } from 'fastify'
import { ContactType, InteractionType } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import {
  listContactsQuery,
  createContactBody,
  updateContactBody,
  createInteractionBody,
  updateInteractionBody,
} from './schemas'

export const contactRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/v1/contacts ──────────────────────────────────────────────────
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const query = listContactsQuery.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: query.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { cursor, limit, search, type } = query.data

    const contacts = await prisma.contact.findMany({
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        cabinetId: request.cabinetId,
        deletedAt: null,
        ...(type ? { type: type as ContactType } : {}),
        ...(search
          ? {
              OR: [
                { lastName: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    const hasMore = contacts.length > limit
    const items = hasMore ? contacts.slice(0, limit) : contacts
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return reply.send({ data: { contacts: items, nextCursor, hasMore } })
  })

  // ── GET /api/v1/contacts/:id ──────────────────────────────────────────────
  app.get('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const contact = await prisma.contact.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
      include: {
        interactions: {
          where: { deletedAt: null },
          orderBy: { occurredAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, email: true } } },
        },
      },
    })

    if (!contact) {
      return reply.status(404).send({ error: 'Contact introuvable', code: 'NOT_FOUND' })
    }

    return reply.send({ data: { contact } })
  })

  // ── POST /api/v1/contacts ─────────────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createContactBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const contact = await prisma.contact.create({
      data: {
        ...result.data,
        type: result.data.type as ContactType,
        cabinetId: request.cabinetId,
      },
    })

    return reply.status(201).send({ data: { contact } })
  })

  // ── PATCH /api/v1/contacts/:id ────────────────────────────────────────────
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = updateContactBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.contact.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Contact introuvable', code: 'NOT_FOUND' })
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: { ...result.data, ...(result.data.type ? { type: result.data.type as ContactType } : {}) },
    })

    return reply.send({ data: { contact } })
  })

  // ── DELETE /api/v1/contacts/:id ───────────────────────────────────────────
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.contact.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Contact introuvable', code: 'NOT_FOUND' })
    }

    await prisma.contact.update({ where: { id }, data: { deletedAt: new Date() } })
    return reply.status(204).send()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // INTERACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  // ── GET /api/v1/contacts/:id/interactions ─────────────────────────────────
  app.get('/:id/interactions', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const contactExists = await prisma.contact.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!contactExists) {
      return reply.status(404).send({ error: 'Contact introuvable', code: 'NOT_FOUND' })
    }

    const interactions = await prisma.interaction.findMany({
      where: { contactId: id, deletedAt: null },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { occurredAt: 'desc' },
    })

    return reply.send({ data: { interactions } })
  })

  // ── POST /api/v1/contacts/:id/interactions ────────────────────────────────
  app.post('/:id/interactions', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = createInteractionBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const contactExists = await prisma.contact.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!contactExists) {
      return reply.status(404).send({ error: 'Contact introuvable', code: 'NOT_FOUND' })
    }

    const interaction = await prisma.interaction.create({
      data: {
        contactId: id,
        userId: request.user.id,
        type: result.data.type as InteractionType,
        note: result.data.note,
        occurredAt: new Date(result.data.occurredAt),
      },
      include: { user: { select: { id: true, email: true } } },
    })

    return reply.status(201).send({ data: { interaction } })
  })

  // ── PATCH /api/v1/contacts/:id/interactions/:interactionId ────────────────
  app.patch('/:id/interactions/:interactionId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, interactionId } = request.params as { id: string; interactionId: string }

    const result = updateInteractionBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    // Vérifie que l'interaction appartient bien à ce contact/cabinet
    const existing = await prisma.interaction.findFirst({
      where: { id: interactionId, contactId: id, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Interaction introuvable', code: 'NOT_FOUND' })
    }

    const interaction = await prisma.interaction.update({
      where: { id: interactionId },
      data: {
        ...(result.data.type ? { type: result.data.type as InteractionType } : {}),
        ...(result.data.note !== undefined ? { note: result.data.note } : {}),
        ...(result.data.occurredAt ? { occurredAt: new Date(result.data.occurredAt) } : {}),
      },
      include: { user: { select: { id: true, email: true } } },
    })

    return reply.send({ data: { interaction } })
  })

  // ── DELETE /api/v1/contacts/:id/interactions/:interactionId ───────────────
  app.delete('/:id/interactions/:interactionId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, interactionId } = request.params as { id: string; interactionId: string }

    const existing = await prisma.interaction.findFirst({
      where: { id: interactionId, contactId: id, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Interaction introuvable', code: 'NOT_FOUND' })
    }

    await prisma.interaction.update({ where: { id: interactionId }, data: { deletedAt: new Date() } })
    return reply.status(204).send()
  })
}
