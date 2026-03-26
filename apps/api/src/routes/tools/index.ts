import { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { computeDiff } from '../../lib/diff'
import {
  listToolsQuery,
  createToolBody,
  updateToolBody,
  upsertCabinetToolBody,
  publicRatingBody,
} from './schemas'

export const toolRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/v1/tools ─────────────────────────────────────────────────────
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const query = listToolsQuery.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: query.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { cursor, limit, search, category } = query.data

    const tools = await prisma.tool.findMany({
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        deletedAt: null,
        ...(category ? { category } : {}),
        ...(search
          ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    const hasMore = tools.length > limit
    const items = hasMore ? tools.slice(0, limit) : tools
    const nextCursor = hasMore ? items[items.length - 1].id : null

    const toolIds = items.map((t) => t.id)
    const [cabinetTools, publicRatings] = await Promise.all([
      prisma.cabinetTool.findMany({
        where: { cabinetId: request.cabinetId, toolId: { in: toolIds }, deletedAt: null },
      }),
      prisma.toolPublicRating.findMany({
        where: { cabinetId: request.cabinetId, toolId: { in: toolIds } },
      }),
    ])

    const cabinetDataMap = new Map(cabinetTools.map((ct) => [ct.toolId, ct]))
    const ratingMap = new Map(publicRatings.map((r) => [r.toolId, r.rating]))

    const data = items.map((t) => ({
      ...t,
      cabinetData: cabinetDataMap.get(t.id) ?? null,
      myPublicRating: ratingMap.get(t.id) ?? null,
    }))

    return reply.send({ data: { tools: data, nextCursor, hasMore } })
  })

  // ── GET /api/v1/tools/:id ─────────────────────────────────────────────────
  app.get('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const tool = await prisma.tool.findUnique({
      where: { id, deletedAt: null },
      include: { creator: { select: { id: true, email: true } } },
    })
    if (!tool) {
      return reply.status(404).send({ error: 'Outil introuvable', code: 'NOT_FOUND' })
    }

    const [cabinetData, myPublicRating] = await Promise.all([
      prisma.cabinetTool.findFirst({
        where: { toolId: id, cabinetId: request.cabinetId, deletedAt: null },
      }),
      prisma.toolPublicRating.findUnique({
        where: { toolId_cabinetId: { toolId: id, cabinetId: request.cabinetId } },
      }),
    ])

    return reply.send({ data: { tool, cabinetData, myPublicRating: myPublicRating?.rating ?? null } })
  })

  // ── POST /api/v1/tools ────────────────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createToolBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const tool = await prisma.tool.create({
      data: { ...result.data, createdBy: request.user.id },
    })

    return reply.status(201).send({ data: { tool } })
  })

  // ── PATCH /api/v1/tools/:id ───────────────────────────────────────────────
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = updateToolBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.tool.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      return reply.status(404).send({ error: 'Outil introuvable', code: 'NOT_FOUND' })
    }

    const [tool] = await prisma.$transaction([
      prisma.tool.update({ where: { id }, data: result.data }),
      prisma.toolEdit.create({
        data: {
          toolId: id,
          editedBy: request.user.id,
          cabinetId: request.cabinetId,
          diff: computeDiff(existing as unknown as Record<string, unknown>, result.data as Record<string, unknown>) as object,
        },
      }),
    ])

    return reply.send({ data: { tool } })
  })

  // ── GET /api/v1/tools/:id/edits ───────────────────────────────────────────
  app.get('/:id/edits', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const edits = await prisma.toolEdit.findMany({
      where: { toolId: id },
      include: { editor: { select: { id: true, email: true } } },
      orderBy: { editedAt: 'desc' },
      take: 50,
    })
    return reply.send({ data: { edits } })
  })

  // ── PUT /api/v1/tools/:id/cabinet ─────────────────────────────────────────
  app.put('/:id/cabinet', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = upsertCabinetToolBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const toolExists = await prisma.tool.findUnique({ where: { id, deletedAt: null } })
    if (!toolExists) {
      return reply.status(404).send({ error: 'Outil introuvable', code: 'NOT_FOUND' })
    }

    const cabinetData = await prisma.cabinetTool.upsert({
      where: { cabinetId_toolId: { cabinetId: request.cabinetId, toolId: id } },
      update: result.data,
      create: { cabinetId: request.cabinetId, toolId: id, ...result.data },
    })

    return reply.send({ data: { cabinetData } })
  })

  // ── PUT /api/v1/tools/:id/rating ──────────────────────────────────────────
  app.put('/:id/rating', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = publicRatingBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const toolExists = await prisma.tool.findUnique({ where: { id, deletedAt: null } })
    if (!toolExists) {
      return reply.status(404).send({ error: 'Outil introuvable', code: 'NOT_FOUND' })
    }

    const rating = await prisma.toolPublicRating.upsert({
      where: { toolId_cabinetId: { toolId: id, cabinetId: request.cabinetId } },
      update: { rating: result.data.rating },
      create: { toolId: id, cabinetId: request.cabinetId, rating: result.data.rating },
    })

    return reply.send({ data: { rating } })
  })

  // ── DELETE /api/v1/tools/:id/rating ──────────────────────────────────────
  app.delete('/:id/rating', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.toolPublicRating.findUnique({
      where: { toolId_cabinetId: { toolId: id, cabinetId: request.cabinetId } },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Aucune note à supprimer', code: 'NOT_FOUND' })
    }

    await prisma.toolPublicRating.delete({
      where: { toolId_cabinetId: { toolId: id, cabinetId: request.cabinetId } },
    })

    return reply.status(204).send()
  })

  // ── POST /api/v1/tools/:id/review ─────────────────────────────────────────
  app.post('/:id/review', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { rating: number; comment: string }

    if (!body?.rating || body.rating < 1 || body.rating > 5) {
      return reply.status(400).send({ error: 'Note invalide (1-5)', code: 'VALIDATION_ERROR' })
    }
    if (!body?.comment?.trim()) {
      return reply.status(400).send({ error: 'Commentaire requis', code: 'VALIDATION_ERROR' })
    }

    const toolExists = await prisma.tool.findUnique({ where: { id, deletedAt: null } })
    if (!toolExists) return reply.status(404).send({ error: 'Outil introuvable', code: 'NOT_FOUND' })

    const review = await prisma.toolReview.upsert({
      where: { toolId_cabinetId: { toolId: id, cabinetId: request.cabinetId } },
      create: { toolId: id, cabinetId: request.cabinetId, rating: body.rating, comment: body.comment.trim() },
      update: { rating: body.rating, comment: body.comment.trim() },
      include: { cabinet: { select: { id: true, name: true } } },
    })

    return reply.send({ data: { review } })
  })

  // ── GET /api/v1/tools/:id/reviews ─────────────────────────────────────────
  app.get('/:id/reviews', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const reviews = await prisma.toolReview.findMany({
      where: { toolId: id },
      orderBy: { createdAt: 'desc' },
      include: { cabinet: { select: { id: true, name: true } } },
    })

    const myReview = reviews.find((r) => r.cabinetId === request.cabinetId) ?? null

    return reply.send({ data: { reviews, myReview } })
  })
}
