import { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { computeDiff } from '../../lib/diff'
import {
  listSuppliersQuery,
  createSupplierBody,
  updateSupplierBody,
  upsertCabinetSupplierBody,
  publicRatingBody,
} from './schemas'

export const supplierRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/v1/suppliers ─────────────────────────────────────────────────
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const query = listSuppliersQuery.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: query.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { cursor, limit, search, category } = query.data

    const where = {
      deletedAt: null,
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        take: limit + 1,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supplier.count({ where }),
    ])

    const hasMore = suppliers.length > limit
    const items = hasMore ? suppliers.slice(0, limit) : suppliers
    const nextCursor = hasMore ? items[items.length - 1].id : null

    // Enrichit avec les données privées et rating du cabinet courant
    const supplierIds = items.map((s) => s.id)
    const [cabinetSuppliers, publicRatings] = await Promise.all([
      prisma.cabinetSupplier.findMany({
        where: { cabinetId: request.cabinetId, supplierId: { in: supplierIds }, deletedAt: null },
      }),
      prisma.supplierPublicRating.findMany({
        where: { cabinetId: request.cabinetId, supplierId: { in: supplierIds } },
      }),
    ])

    const cabinetDataMap = new Map(cabinetSuppliers.map((cs) => [cs.supplierId, cs]))
    const ratingMap = new Map(publicRatings.map((r) => [r.supplierId, r.rating]))

    const data = items.map((s) => ({
      ...s,
      cabinetData: cabinetDataMap.get(s.id) ?? null,
      myPublicRating: ratingMap.get(s.id) ?? null,
    }))

    return reply.send({ data: { suppliers: data, nextCursor, hasMore, total } })
  })

  // ── GET /api/v1/suppliers/:id ─────────────────────────────────────────────
  app.get('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const supplier = await prisma.supplier.findUnique({
      where: { id, deletedAt: null },
      include: { creator: { select: { id: true, email: true } } },
    })
    if (!supplier) {
      return reply.status(404).send({ error: 'Fournisseur introuvable', code: 'NOT_FOUND' })
    }

    const [cabinetData, myPublicRating, editsCount] = await Promise.all([
      prisma.cabinetSupplier.findFirst({
        where: { supplierId: id, cabinetId: request.cabinetId, deletedAt: null },
      }),
      prisma.supplierPublicRating.findUnique({
        where: { supplierId_cabinetId: { supplierId: id, cabinetId: request.cabinetId } },
      }),
      prisma.supplierEdit.count({ where: { supplierId: id } }),
    ])

    return reply.send({
      data: { supplier, cabinetData, myPublicRating: myPublicRating?.rating ?? null, editsCount },
    })
  })

  // ── POST /api/v1/suppliers ────────────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createSupplierBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const supplier = await prisma.supplier.create({
      data: { ...result.data, createdBy: request.user.id },
    })

    return reply.status(201).send({ data: { supplier } })
  })

  // ── PATCH /api/v1/suppliers/:id ───────────────────────────────────────────
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = updateSupplierBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.supplier.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      return reply.status(404).send({ error: 'Fournisseur introuvable', code: 'NOT_FOUND' })
    }

    const [supplier] = await prisma.$transaction([
      prisma.supplier.update({ where: { id }, data: result.data }),
      prisma.supplierEdit.create({
        data: {
          supplierId: id,
          editedBy: request.user.id,
          cabinetId: request.cabinetId,
          diff: computeDiff(
            existing as unknown as Record<string, unknown>,
            result.data as Record<string, unknown>
          ) as object,
        },
      }),
    ])

    return reply.send({ data: { supplier } })
  })

  // ── GET /api/v1/suppliers/:id/edits ──────────────────────────────────────
  app.get('/:id/edits', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const edits = await prisma.supplierEdit.findMany({
      where: { supplierId: id },
      include: { editor: { select: { id: true, email: true } } },
      orderBy: { editedAt: 'desc' },
      take: 50,
    })

    return reply.send({ data: { edits } })
  })

  // ── PUT /api/v1/suppliers/:id/cabinet ────────────────────────────────────
  app.put(
    '/:id/cabinet',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const result = upsertCabinetSupplierBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }

      const supplierExists = await prisma.supplier.findUnique({ where: { id, deletedAt: null } })
      if (!supplierExists) {
        return reply.status(404).send({ error: 'Fournisseur introuvable', code: 'NOT_FOUND' })
      }

      const cabinetData = await prisma.cabinetSupplier.upsert({
        where: { cabinetId_supplierId: { cabinetId: request.cabinetId, supplierId: id } },
        update: result.data,
        create: { cabinetId: request.cabinetId, supplierId: id, ...result.data },
      })

      return reply.send({ data: { cabinetData } })
    }
  )

  // ── PUT /api/v1/suppliers/:id/rating ─────────────────────────────────────
  app.put(
    '/:id/rating',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const result = publicRatingBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }

      const supplierExists = await prisma.supplier.findUnique({ where: { id, deletedAt: null } })
      if (!supplierExists) {
        return reply.status(404).send({ error: 'Fournisseur introuvable', code: 'NOT_FOUND' })
      }

      // Upsert — le trigger Postgres recalcule avg_public_rating automatiquement
      const rating = await prisma.supplierPublicRating.upsert({
        where: { supplierId_cabinetId: { supplierId: id, cabinetId: request.cabinetId } },
        update: { rating: result.data.rating },
        create: { supplierId: id, cabinetId: request.cabinetId, rating: result.data.rating },
      })

      return reply.send({ data: { rating } })
    }
  )

  // ── POST /api/v1/suppliers/:id/review ────────────────────────────────────
  app.post('/:id/review', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { rating: number; comment: string }

    if (!body?.rating || body.rating < 1 || body.rating > 5) {
      return reply.status(400).send({ error: 'Note invalide (1-5)', code: 'VALIDATION_ERROR' })
    }
    if (!body?.comment?.trim()) {
      return reply.status(400).send({ error: 'Commentaire requis', code: 'VALIDATION_ERROR' })
    }

    const supplier = await prisma.supplier.findUnique({ where: { id, deletedAt: null } })
    if (!supplier) return reply.status(404).send({ error: 'Fournisseur introuvable', code: 'NOT_FOUND' })

    const review = await prisma.supplierReview.upsert({
      where: { supplierId_cabinetId: { supplierId: id, cabinetId: request.cabinetId } },
      create: { supplierId: id, cabinetId: request.cabinetId, rating: body.rating, comment: body.comment.trim() },
      update: { rating: body.rating, comment: body.comment.trim() },
      include: { cabinet: { select: { id: true, name: true } } },
    })

    return reply.send({ data: { review } })
  })

  // ── GET /api/v1/suppliers/:id/reviews ────────────────────────────────────
  app.get('/:id/reviews', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const reviews = await prisma.supplierReview.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: 'desc' },
      include: { cabinet: { select: { id: true, name: true } } },
    })

    const myReview = reviews.find((r) => r.cabinetId === request.cabinetId) ?? null

    return reply.send({ data: { reviews, myReview } })
  })

  // ── DELETE /api/v1/suppliers/:id/rating ──────────────────────────────────
  app.delete(
    '/:id/rating',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const existing = await prisma.supplierPublicRating.findUnique({
        where: { supplierId_cabinetId: { supplierId: id, cabinetId: request.cabinetId } },
      })
      if (!existing) {
        return reply.status(404).send({ error: 'Aucune note à supprimer', code: 'NOT_FOUND' })
      }

      // Le trigger recalcule avg_public_rating après DELETE
      await prisma.supplierPublicRating.delete({
        where: { supplierId_cabinetId: { supplierId: id, cabinetId: request.cabinetId } },
      })

      return reply.status(204).send()
    }
  )
}
