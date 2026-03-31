import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { computeAdequacy } from '../../lib/adequacy'

// ── Zod schema ────────────────────────────────────────────────────────────────

const profileBody = z.object({
  classificationMifid: z
    .enum(['non_professionnel', 'professionnel', 'contrepartie_eligible'])
    .nullable()
    .optional(),
  connaissance: z.enum(['basique', 'informe', 'expert']).nullable().optional(),
  experience: z.enum(['faible', 'moyenne', 'elevee']).nullable().optional(),
  capacitePertes: z.enum(['aucune', 'limitee', 'capital', 'superieure']).nullable().optional(),
  sri: z.number().int().min(1).max(7).nullable().optional(),
  horizon: z.enum(['moins_2_ans', '2_5_ans', 'plus_5_ans']).nullable().optional(),
  objectifs: z
    .array(z.enum(['preservation', 'croissance', 'revenus', 'fiscal']))
    .optional()
    .default([]),
  aPreferencesDurabilite: z.boolean().optional().default(false),
  pctTaxonomieSouhaite: z.number().min(0).max(1).nullable().optional(),
  pctSfdrEnvSouhaite: z.number().min(0).max(1).nullable().optional(),
  pctSfdrSocialSouhaite: z.number().min(0).max(1).nullable().optional(),
  paiGesSocietes: z.boolean().optional().default(false),
  paiBiodiversite: z.boolean().optional().default(false),
  paiEau: z.boolean().optional().default(false),
  paiDechets: z.boolean().optional().default(false),
  paiSocialPersonnel: z.boolean().optional().default(false),
  paiGesSouverains: z.boolean().optional().default(false),
  paiNormesSociales: z.boolean().optional().default(false),
  paiCombustiblesFossiles: z.boolean().optional().default(false),
  paiImmobilierEnergetique: z.boolean().optional().default(false),
  notes: z.string().nullable().optional(),
})

// ── Plugin ────────────────────────────────────────────────────────────────────

export const contactProfileRoutes: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((err, _req, reply) => {
    if ((err as { code?: string }).code === 'P2021') {
      return reply.status(503).send({
        error: 'Migration en attente : exécutez la migration contact_profile.',
        code: 'MIGRATION_PENDING',
      })
    }
    reply.send(err)
  })

  // ── GET /api/v1/contacts/profile/due-review ───────────────────────────────
  app.get(
    '/profile/due-review',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const items = await prisma.cabinetContactProfile.findMany({
        where: {
          cabinetId: request.cabinetId,
          status: 'active',
          nextReviewDate: { lte: in30Days },
        },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, type: true } },
        },
        orderBy: { nextReviewDate: 'asc' },
      })
      return reply.send({ data: { items } })
    }
  )

  // ── GET /api/v1/contacts/:id/profile ─────────────────────────────────────
  app.get(
    '/:id/profile',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const active = await prisma.cabinetContactProfile.findFirst({
        where: { cabinetId: request.cabinetId, contactId: id, status: 'active' },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send({ data: { profile: active } })
    }
  )

  // ── GET /api/v1/contacts/:id/profile/history ─────────────────────────────
  app.get(
    '/:id/profile/history',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const history = await prisma.cabinetContactProfile.findMany({
        where: { cabinetId: request.cabinetId, contactId: id },
        orderBy: { profilDate: 'desc' },
      })
      return reply.send({ data: { history } })
    }
  )

  // ── POST /api/v1/contacts/:id/profile ────────────────────────────────────
  // Crée ou révise le profil (archive l'actif, crée un nouveau)
  app.post(
    '/:id/profile',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const cabinetId = request.cabinetId

      const result = profileBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }

      const profilDate = new Date()
      const nextReviewDate = new Date(profilDate)
      nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1)

      const profile = await prisma.$transaction(async (tx) => {
        // Archiver les profils actifs existants
        await tx.cabinetContactProfile.updateMany({
          where: { cabinetId, contactId: id, status: 'active' },
          data: { status: 'archived' },
        })
        // Créer le nouveau profil actif
        return tx.cabinetContactProfile.create({
          data: {
            cabinetId,
            contactId: id,
            ...result.data,
            status: 'active',
            profilDate,
            nextReviewDate,
          },
        })
      })

      return reply.status(201).send({ data: { profile } })
    }
  )

  // ── PUT /api/v1/contacts/:id/profile/:profileId ───────────────────────────
  app.put(
    '/:id/profile/:profileId',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id, profileId } = request.params as { id: string; profileId: string }
      const cabinetId = request.cabinetId

      const existing = await prisma.cabinetContactProfile.findUnique({ where: { id: profileId } })
      if (!existing || existing.cabinetId !== cabinetId || existing.contactId !== id) {
        return reply.status(404).send({ error: 'Profil introuvable', code: 'NOT_FOUND' })
      }
      if (existing.status !== 'active') {
        return reply.status(400).send({ error: 'Seul un profil actif peut être modifié', code: 'NOT_ACTIVE' })
      }

      const result = profileBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }

      const profile = await prisma.cabinetContactProfile.update({
        where: { id: profileId },
        data: result.data,
      })

      return reply.send({ data: { profile } })
    }
  )

  // ── GET /api/v1/contacts/:id/adequacy/:productId ──────────────────────────
  app.get(
    '/:id/adequacy/:productId',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id, productId } = request.params as { id: string; productId: string }
      const cabinetId = request.cabinetId

      const [profile, governance] = await Promise.all([
        prisma.cabinetContactProfile.findFirst({
          where: { cabinetId, contactId: id, status: 'active' },
        }),
        prisma.cabinetProductGovernance.findFirst({
          where: { cabinetId, productId, status: 'active' },
        }),
      ])

      if (!profile || !governance) {
        return reply.send({ data: { adequacy: null, error: 'profile_or_governance_missing' } })
      }

      const adequacy = computeAdequacy(profile, governance)
      return reply.send({ data: { adequacy } })
    }
  )

  // ── GET /api/v1/contacts/:id/adequacy ─────────────────────────────────────
  // Adéquation avec tous les produits du cabinet ayant une gouvernance active
  app.get(
    '/:id/adequacy',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const cabinetId = request.cabinetId

      const profile = await prisma.cabinetContactProfile.findFirst({
        where: { cabinetId, contactId: id, status: 'active' },
      })

      if (!profile) {
        return reply.send({ data: { results: [], hasProfile: false } })
      }

      // Produits vendus à ce contact (pour inclure même les retirés du marché)
      const soldProductIds = await prisma.contactProduct.findMany({
        where: { cabinetId, contactId: id },
        select: { productId: true },
      }).then((rows) => rows.map((r) => r.productId))

      const governances = await prisma.cabinetProductGovernance.findMany({
        where: {
          cabinetId,
          status: 'active',
          product: {
            OR: [
              { isActive: true },
              { id: { in: soldProductIds } },
            ],
          },
        },
        include: { product: { select: { id: true, name: true, category: true, isActive: true } } },
        orderBy: { product: { name: 'asc' } },
      })

      const results = governances.map((gov) => ({
        product: gov.product,
        governance: gov,
        adequacy: computeAdequacy(profile, gov),
      }))

      return reply.send({ data: { results, hasProfile: true } })
    }
  )

  // ── GET /api/v1/contacts/:id/products ────────────────────────────────────
  app.get(
    '/:id/products',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const items = await prisma.contactProduct.findMany({
        where: { cabinetId: request.cabinetId, contactId: id },
        include: {
          product: { select: { id: true, name: true, category: true, mainCategory: true } },
        },
        orderBy: { soldAt: 'desc' },
      })
      return reply.send({ data: { items } })
    }
  )

  // ── POST /api/v1/contacts/:id/products ───────────────────────────────────
  app.post(
    '/:id/products',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = z.object({
        productId: z.string().uuid(),
        soldAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
        amount: z.number().positive().nullable().optional(),
        notes: z.string().nullable().optional(),
      }).safeParse(request.body)

      if (!body.success) {
        return reply.status(400).send({ error: body.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }

      const item = await prisma.contactProduct.create({
        data: {
          cabinetId: request.cabinetId,
          contactId: id,
          productId: body.data.productId,
          soldAt: new Date(body.data.soldAt),
          amount: body.data.amount ?? null,
          notes: body.data.notes ?? null,
        },
        include: {
          product: { select: { id: true, name: true, category: true, mainCategory: true } },
        },
      })
      return reply.status(201).send({ data: { item } })
    }
  )

  // ── PATCH /api/v1/contacts/:id/products/:productEntryId ──────────────────
  app.patch(
    '/:id/products/:productEntryId',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id, productEntryId } = request.params as { id: string; productEntryId: string }
      const body = z.object({
        soldAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        amount: z.number().positive().nullable().optional(),
        notes: z.string().nullable().optional(),
      }).safeParse(request.body)

      if (!body.success) {
        return reply.status(400).send({ error: body.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }

      const entry = await prisma.contactProduct.findFirst({
        where: { id: productEntryId, cabinetId: request.cabinetId, contactId: id },
      })
      if (!entry) return reply.status(404).send({ error: 'Entrée introuvable', code: 'NOT_FOUND' })

      const updated = await prisma.contactProduct.update({
        where: { id: productEntryId },
        data: {
          ...(body.data.soldAt ? { soldAt: new Date(body.data.soldAt) } : {}),
          ...(body.data.amount !== undefined ? { amount: body.data.amount } : {}),
          ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
        },
        include: {
          product: { select: { id: true, name: true, category: true, mainCategory: true } },
        },
      })
      return reply.send({ data: { item: updated } })
    }
  )

  // ── DELETE /api/v1/contacts/:id/products/:productEntryId ─────────────────
  app.delete(
    '/:id/products/:productEntryId',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id, productEntryId } = request.params as { id: string; productEntryId: string }
      const entry = await prisma.contactProduct.findFirst({
        where: { id: productEntryId, cabinetId: request.cabinetId, contactId: id },
      })
      if (!entry) return reply.status(404).send({ error: 'Entrée introuvable', code: 'NOT_FOUND' })
      await prisma.contactProduct.delete({ where: { id: productEntryId } })
      return reply.status(204).send()
    }
  )

  // ── PATRIMOINE — ACTIFS ───────────────────────────────────────────────────

  const assetBody = z.object({
    type: z.enum(['immobilier', 'financier', 'professionnel', 'autre']),
    label: z.string().min(1),
    estimatedValue: z.number().nonnegative(),
    notes: z.string().nullable().optional(),
  })

  app.get('/:id/assets', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const items = await prisma.contactAsset.findMany({
      where: { cabinetId: request.cabinetId, contactId: id },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ data: { items } })
  })

  app.post('/:id/assets', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = assetBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.errors[0].message, code: 'VALIDATION_ERROR' })
    const item = await prisma.contactAsset.create({
      data: { cabinetId: request.cabinetId, contactId: id, ...body.data, notes: body.data.notes ?? null },
    })
    return reply.status(201).send({ data: { item } })
  })

  app.patch('/:id/assets/:assetId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, assetId } = request.params as { id: string; assetId: string }
    const body = assetBody.partial().safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.errors[0].message, code: 'VALIDATION_ERROR' })
    const entry = await prisma.contactAsset.findFirst({ where: { id: assetId, cabinetId: request.cabinetId, contactId: id } })
    if (!entry) return reply.status(404).send({ error: 'Introuvable', code: 'NOT_FOUND' })
    const item = await prisma.contactAsset.update({ where: { id: assetId }, data: body.data })
    return reply.send({ data: { item } })
  })

  app.delete('/:id/assets/:assetId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, assetId } = request.params as { id: string; assetId: string }
    const entry = await prisma.contactAsset.findFirst({ where: { id: assetId, cabinetId: request.cabinetId, contactId: id } })
    if (!entry) return reply.status(404).send({ error: 'Introuvable', code: 'NOT_FOUND' })
    await prisma.contactAsset.delete({ where: { id: assetId } })
    return reply.status(204).send()
  })

  // ── PATRIMOINE — PASSIFS ──────────────────────────────────────────────────

  const liabilityBody = z.object({
    type: z.enum(['immobilier', 'consommation', 'professionnel', 'autre']),
    label: z.string().min(1),
    outstandingAmount: z.number().nonnegative(),
    monthlyPayment: z.number().nonnegative().nullable().optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    notes: z.string().nullable().optional(),
  })

  app.get('/:id/liabilities', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const items = await prisma.contactLiability.findMany({
      where: { cabinetId: request.cabinetId, contactId: id },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ data: { items } })
  })

  app.post('/:id/liabilities', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = liabilityBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.errors[0].message, code: 'VALIDATION_ERROR' })
    const item = await prisma.contactLiability.create({
      data: {
        cabinetId: request.cabinetId,
        contactId: id,
        ...body.data,
        monthlyPayment: body.data.monthlyPayment ?? null,
        endDate: body.data.endDate ? new Date(body.data.endDate) : null,
        notes: body.data.notes ?? null,
      },
    })
    return reply.status(201).send({ data: { item } })
  })

  app.patch('/:id/liabilities/:liabilityId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, liabilityId } = request.params as { id: string; liabilityId: string }
    const body = liabilityBody.partial().safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.errors[0].message, code: 'VALIDATION_ERROR' })
    const entry = await prisma.contactLiability.findFirst({ where: { id: liabilityId, cabinetId: request.cabinetId, contactId: id } })
    if (!entry) return reply.status(404).send({ error: 'Introuvable', code: 'NOT_FOUND' })
    const item = await prisma.contactLiability.update({
      where: { id: liabilityId },
      data: { ...body.data, endDate: body.data.endDate !== undefined ? (body.data.endDate ? new Date(body.data.endDate) : null) : undefined },
    })
    return reply.send({ data: { item } })
  })

  app.delete('/:id/liabilities/:liabilityId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, liabilityId } = request.params as { id: string; liabilityId: string }
    const entry = await prisma.contactLiability.findFirst({ where: { id: liabilityId, cabinetId: request.cabinetId, contactId: id } })
    if (!entry) return reply.status(404).send({ error: 'Introuvable', code: 'NOT_FOUND' })
    await prisma.contactLiability.delete({ where: { id: liabilityId } })
    return reply.status(204).send()
  })

  // ── PATRIMOINE — REVENUS ──────────────────────────────────────────────────

  const incomeBody = z.object({
    type: z.enum(['salaire', 'foncier', 'dividendes', 'pension', 'autre']),
    label: z.string().min(1),
    annualAmount: z.number().nonnegative(),
    notes: z.string().nullable().optional(),
  })

  app.get('/:id/incomes', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const items = await prisma.contactIncome.findMany({
      where: { cabinetId: request.cabinetId, contactId: id },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ data: { items } })
  })

  app.post('/:id/incomes', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = incomeBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.errors[0].message, code: 'VALIDATION_ERROR' })
    const item = await prisma.contactIncome.create({
      data: { cabinetId: request.cabinetId, contactId: id, ...body.data, notes: body.data.notes ?? null },
    })
    return reply.status(201).send({ data: { item } })
  })

  app.patch('/:id/incomes/:incomeId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, incomeId } = request.params as { id: string; incomeId: string }
    const body = incomeBody.partial().safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.errors[0].message, code: 'VALIDATION_ERROR' })
    const entry = await prisma.contactIncome.findFirst({ where: { id: incomeId, cabinetId: request.cabinetId, contactId: id } })
    if (!entry) return reply.status(404).send({ error: 'Introuvable', code: 'NOT_FOUND' })
    const item = await prisma.contactIncome.update({ where: { id: incomeId }, data: body.data })
    return reply.send({ data: { item } })
  })

  app.delete('/:id/incomes/:incomeId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, incomeId } = request.params as { id: string; incomeId: string }
    const entry = await prisma.contactIncome.findFirst({ where: { id: incomeId, cabinetId: request.cabinetId, contactId: id } })
    if (!entry) return reply.status(404).send({ error: 'Introuvable', code: 'NOT_FOUND' })
    await prisma.contactIncome.delete({ where: { id: incomeId } })
    return reply.status(204).send()
  })

  // ── PATRIMOINE — FISCALITÉ ────────────────────────────────────────────────

  const taxBody = z.object({
    tmi: z.number().min(0).max(1).nullable().optional(),
    regime: z.enum(['ir', 'is']).nullable().optional(),
    pfuOption: z.boolean().optional(),
    ifi: z.boolean().optional(),
    ifiValue: z.number().nonnegative().nullable().optional(),
    notes: z.string().nullable().optional(),
  })

  app.get('/:id/tax', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tax = await prisma.contactTax.findFirst({ where: { cabinetId: request.cabinetId, contactId: id } })
    return reply.send({ data: { tax } })
  })

  app.put('/:id/tax', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = taxBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.errors[0].message, code: 'VALIDATION_ERROR' })
    const tax = await prisma.contactTax.upsert({
      where: { cabinetId_contactId: { cabinetId: request.cabinetId, contactId: id } },
      create: { cabinetId: request.cabinetId, contactId: id, ...body.data, tmi: body.data.tmi ?? null, regime: body.data.regime ?? null, ifiValue: body.data.ifiValue ?? null, notes: body.data.notes ?? null },
      update: body.data,
    })
    return reply.send({ data: { tax } })
  })
}
