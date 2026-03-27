import { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { computeDiff } from '../../lib/diff'
import { governanceRoutes } from './governance'
import {
  listProductsQuery,
  createProductBody,
  updateProductBody,
  upsertCabinetProductBody,
  publicRatingBody,
  linkSupplierBody,
} from './schemas'

export const productRoutes: FastifyPluginAsync = async (app) => {
  // Governance sub-routes (registered first to avoid :id matching /governance/...)
  await app.register(governanceRoutes)
  // ── GET /api/v1/products ──────────────────────────────────────────────────
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const query = listProductsQuery.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: query.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { cursor, limit, search, category, supplierId } = query.data

    const products = await prisma.product.findMany({
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        deletedAt: null,
        ...(category ? { category } : {}),
        ...(supplierId ? { supplierLinks: { some: { supplierId } } } : {}),
        ...(search
          ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    const hasMore = products.length > limit
    const items = hasMore ? products.slice(0, limit) : products
    const nextCursor = hasMore ? items[items.length - 1].id : null

    const productIds = items.map((p) => p.id)
    const [cabinetProducts, publicRatings, governances] = await Promise.all([
      prisma.cabinetProduct.findMany({
        where: { cabinetId: request.cabinetId, productId: { in: productIds }, deletedAt: null },
      }),
      prisma.productPublicRating.findMany({
        where: { cabinetId: request.cabinetId, productId: { in: productIds } },
      }),
      prisma.cabinetProductGovernance.findMany({
        where: { cabinetId: request.cabinetId, productId: { in: productIds } },
        orderBy: { revisionDate: 'desc' },
      }),
    ])

    const cabinetDataMap = new Map(cabinetProducts.map((cp) => [cp.productId, cp]))
    const ratingMap = new Map(publicRatings.map((r) => [r.productId, r.rating]))
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const govMap = new Map<string, { status: string; isDueForRevision: boolean }>()
    for (const gov of governances) {
      const existing = govMap.get(gov.productId)
      const isDue = !!gov.nextRevisionDate && new Date(gov.nextRevisionDate) <= in30Days
      if (!existing || gov.status === 'active' || (gov.status === 'draft' && existing.status !== 'active')) {
        govMap.set(gov.productId, { status: gov.status, isDueForRevision: gov.status === 'active' && isDue })
      }
    }

    const data = items.map((p) => ({
      ...p,
      cabinetData: cabinetDataMap.get(p.id) ?? null,
      myPublicRating: ratingMap.get(p.id) ?? null,
      governanceStatus: govMap.get(p.id) ?? null,
    }))

    return reply.send({ data: { products: data, nextCursor, hasMore } })
  })

  // ── GET /api/v1/products/:id ──────────────────────────────────────────────
  app.get('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const product = await prisma.product.findUnique({
      where: { id, deletedAt: null },
      include: {
        creator: { select: { id: true, email: true } },
        supplierLinks: { include: { supplier: { select: { id: true, name: true } } } },
      },
    })
    if (!product) {
      return reply.status(404).send({ error: 'Produit introuvable', code: 'NOT_FOUND' })
    }

    const [cabinetData, myPublicRating] = await Promise.all([
      prisma.cabinetProduct.findFirst({
        where: { productId: id, cabinetId: request.cabinetId, deletedAt: null },
      }),
      prisma.productPublicRating.findUnique({
        where: { productId_cabinetId: { productId: id, cabinetId: request.cabinetId } },
      }),
    ])

    return reply.send({ data: { product, cabinetData, myPublicRating: myPublicRating?.rating ?? null } })
  })

  // ── POST /api/v1/products ─────────────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createProductBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const product = await prisma.product.create({
      data: { ...result.data, createdBy: request.user.id },
    })

    return reply.status(201).send({ data: { product } })
  })

  // ── PATCH /api/v1/products/:id ────────────────────────────────────────────
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = updateProductBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.product.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      return reply.status(404).send({ error: 'Produit introuvable', code: 'NOT_FOUND' })
    }

    const [product] = await prisma.$transaction([
      prisma.product.update({ where: { id }, data: result.data }),
      prisma.productEdit.create({
        data: {
          productId: id,
          editedBy: request.user.id,
          cabinetId: request.cabinetId,
          diff: computeDiff(existing as unknown as Record<string, unknown>, result.data as Record<string, unknown>) as object,
        },
      }),
    ])

    return reply.send({ data: { product } })
  })

  // ── GET /api/v1/products/:id/edits ────────────────────────────────────────
  app.get('/:id/edits', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const edits = await prisma.productEdit.findMany({
      where: { productId: id },
      include: { editor: { select: { id: true, email: true } } },
      orderBy: { editedAt: 'desc' },
      take: 50,
    })
    return reply.send({ data: { edits } })
  })

  // ── PUT /api/v1/products/:id/cabinet ─────────────────────────────────────
  app.put('/:id/cabinet', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = upsertCabinetProductBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const productExists = await prisma.product.findUnique({ where: { id, deletedAt: null } })
    if (!productExists) {
      return reply.status(404).send({ error: 'Produit introuvable', code: 'NOT_FOUND' })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cabinetData = await prisma.cabinetProduct.upsert({
      where: { cabinetId_productId: { cabinetId: request.cabinetId, productId: id } },
      update: result.data as any,
      create: { cabinetId: request.cabinetId, productId: id, ...result.data as any },
    })

    return reply.send({ data: { cabinetData } })
  })

  // ── PUT /api/v1/products/:id/rating ──────────────────────────────────────
  app.put('/:id/rating', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = publicRatingBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const productExists = await prisma.product.findUnique({ where: { id, deletedAt: null } })
    if (!productExists) {
      return reply.status(404).send({ error: 'Produit introuvable', code: 'NOT_FOUND' })
    }

    const rating = await prisma.productPublicRating.upsert({
      where: { productId_cabinetId: { productId: id, cabinetId: request.cabinetId } },
      update: { rating: result.data.rating },
      create: { productId: id, cabinetId: request.cabinetId, rating: result.data.rating },
    })

    return reply.send({ data: { rating } })
  })

  // ── DELETE /api/v1/products/:id/rating ───────────────────────────────────
  app.delete('/:id/rating', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.productPublicRating.findUnique({
      where: { productId_cabinetId: { productId: id, cabinetId: request.cabinetId } },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Aucune note à supprimer', code: 'NOT_FOUND' })
    }

    await prisma.productPublicRating.delete({
      where: { productId_cabinetId: { productId: id, cabinetId: request.cabinetId } },
    })

    return reply.status(204).send()
  })

  // ── POST /api/v1/products/:id/review ─────────────────────────────────────
  app.post('/:id/review', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { rating: number; comment: string }

    if (!body?.rating || body.rating < 1 || body.rating > 5) {
      return reply.status(400).send({ error: 'Note invalide (1-5)', code: 'VALIDATION_ERROR' })
    }
    if (!body?.comment?.trim()) {
      return reply.status(400).send({ error: 'Commentaire requis', code: 'VALIDATION_ERROR' })
    }

    const product = await prisma.product.findUnique({ where: { id, deletedAt: null } })
    if (!product) return reply.status(404).send({ error: 'Produit introuvable', code: 'NOT_FOUND' })

    const review = await prisma.productReview.upsert({
      where: { productId_cabinetId: { productId: id, cabinetId: request.cabinetId } },
      create: { productId: id, cabinetId: request.cabinetId, rating: body.rating, comment: body.comment.trim() },
      update: { rating: body.rating, comment: body.comment.trim() },
      include: { cabinet: { select: { id: true, name: true } } },
    })

    return reply.send({ data: { review } })
  })

  // ── GET /api/v1/products/:id/reviews ─────────────────────────────────────
  app.get('/:id/reviews', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const reviews = await prisma.productReview.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      include: { cabinet: { select: { id: true, name: true } } },
    })

    const myReview = reviews.find(r => r.cabinetId === request.cabinetId) ?? null

    return reply.send({ data: { reviews, myReview } })
  })

  // ── POST /api/v1/products/:id/suppliers ───────────────────────────────────
  // Lie un produit à un fournisseur (table pivot product_suppliers)
  app.post('/:id/suppliers', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = linkSupplierBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const [productExists, supplierExists] = await Promise.all([
      prisma.product.findUnique({ where: { id, deletedAt: null } }),
      prisma.supplier.findUnique({ where: { id: result.data.supplierId, deletedAt: null } }),
    ])

    if (!productExists) return reply.status(404).send({ error: 'Produit introuvable', code: 'NOT_FOUND' })
    if (!supplierExists) return reply.status(404).send({ error: 'Fournisseur introuvable', code: 'NOT_FOUND' })

    const link = await prisma.productSupplier.upsert({
      where: { productId_supplierId: { productId: id, supplierId: result.data.supplierId } },
      update: {},
      create: { productId: id, supplierId: result.data.supplierId },
    })

    return reply.status(201).send({ data: { link } })
  })

  // ── DELETE /api/v1/products/:id/suppliers/:supplierId ─────────────────────
  app.delete('/:id/suppliers/:supplierId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, supplierId } = request.params as { id: string; supplierId: string }

    await prisma.productSupplier.deleteMany({
      where: { productId: id, supplierId },
    })

    return reply.status(204).send()
  })
}
