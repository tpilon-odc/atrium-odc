import { FastifyPluginAsync } from 'fastify'
import * as XLSX from 'xlsx'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { z } from 'zod'
import { XLSX_COLUMN_HEADERS } from '../../lib/governance-types'

// ── Zod schemas ───────────────────────────────────────────────────────────────

const marcheCibleValue = z.enum(['positif', 'neutre', 'negatif']).nullable().optional()

const governanceBody = z.object({
  // Axe 1
  clientNonProfessionnel: marcheCibleValue,
  clientProfessionnel: marcheCibleValue,
  // Axe 2
  connaissanceBasique: marcheCibleValue,
  connaissanceInforme: marcheCibleValue,
  connaissanceExpert: marcheCibleValue,
  experienceFaible: marcheCibleValue,
  experienceMoyenne: marcheCibleValue,
  experienceElevee: marcheCibleValue,
  // Axe 3
  perteAucune: marcheCibleValue,
  perteLimitee: marcheCibleValue,
  perteCapital: marcheCibleValue,
  perteSuperieurCapital: marcheCibleValue,
  // Axe 4
  risque1: marcheCibleValue,
  risque23: marcheCibleValue,
  risque4: marcheCibleValue,
  risque56: marcheCibleValue,
  risque7: marcheCibleValue,
  // Axe 5
  horizonMoins2Ans: marcheCibleValue,
  horizon25Ans: marcheCibleValue,
  horizonPlus5Ans: marcheCibleValue,
  objectifPreservation: marcheCibleValue,
  objectifCroissance: marcheCibleValue,
  objectifRevenus: marcheCibleValue,
  objectifFiscal: marcheCibleValue,
  // Durabilité
  pctTaxonomie: z.number().min(0).max(1).nullable().optional(),
  pctSfdrEnvironnemental: z.number().min(0).max(1).nullable().optional(),
  pctSfdrSocial: z.number().min(0).max(1).nullable().optional(),
  paiGesSocietes: z.boolean().optional(),
  paiBiodiversite: z.boolean().optional(),
  paiEau: z.boolean().optional(),
  paiDechets: z.boolean().optional(),
  paiSocialPersonnel: z.boolean().optional(),
  paiGesSouverains: z.boolean().optional(),
  paiNormesSociales: z.boolean().optional(),
  paiCombustiblesFossiles: z.boolean().optional(),
  paiImmobilierEnergetique: z.boolean().optional(),
  durabiliteCommuniquee: z.boolean().optional(),
  // Métadonnées
  producteurSoumisMif2: z.boolean().optional(),
  marcheCibleSource: z.string().nullable().optional(),
  revisionDate: z.string().optional(),
  nextRevisionDate: z.string().nullable().optional(),
  notesRevision: z.string().nullable().optional(),
})

// ── Helper : format valeur pour export XLSX ───────────────────────────────────

function xlsxValue(val: string | null | undefined, durabiliteCommuniquee: boolean, isPct = false): string {
  if (!durabiliteCommuniquee && isPct) return 'Non communiqué'
  if (val === null || val === undefined) return ''
  if (val === 'positif') return 'Positif'
  if (val === 'neutre') return 'Neutre'
  if (val === 'negatif') return 'Négatif'
  return String(val)
}

// ── Plugin routes ─────────────────────────────────────────────────────────────

export const governanceRoutes: FastifyPluginAsync = async (app) => {
  // Intercepte les erreurs P2021 (table inexistante) pour tout ce plugin
  app.setErrorHandler((err, _req, reply) => {
    if ((err as { code?: string }).code === 'P2021') {
      return reply.status(503).send({
        error: 'Migration en attente : exécutez la migration cabinet_product_governance sur votre base de données.',
        code: 'MIGRATION_PENDING',
      })
    }
    reply.send(err)
  })
  // ── GET /api/v1/products/governance/export ────────────────────────────────
  app.get('/governance/export', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const cabinetId = request.cabinetId

    const [governances, cabinet] = await Promise.all([
      prisma.cabinetProductGovernance.findMany({
        where: { cabinetId, status: 'active' },
        include: { product: { select: { name: true, category: true } } },
        orderBy: { product: { name: 'asc' } },
      }),
      prisma.cabinet.findUnique({ where: { id: cabinetId }, select: { name: true } }),
    ])

    const wb = XLSX.utils.book_new()

    // ── Feuille 1 : Détermination du marché cible ──────────────────────────
    const headers1 = ['Produit', 'Catégorie', ...XLSX_COLUMN_HEADERS.map((h) => h.label)]
    const rows: unknown[][] = [headers1]

    for (const gov of governances) {
      const row = [
        gov.product.name,
        gov.product.category ?? '',
        ...XLSX_COLUMN_HEADERS.map((h) => {
          const isPct = h.field.startsWith('pct')
          const val = (gov as Record<string, unknown>)[h.field]
          if (isPct) {
            if (!gov.durabiliteCommuniquee) return 'Non communiqué'
            if (val === null || val === undefined) return ''
            return `${Math.round((val as number) * 100)} %`
          }
          return xlsxValue(val as string | null | undefined, gov.durabiliteCommuniquee)
        }),
      ]
      rows.push(row)
    }

    const ws1 = XLSX.utils.aoa_to_sheet(rows)

    // Largeurs colonnes
    ws1['!cols'] = [{ wch: 30 }, { wch: 16 }, ...XLSX_COLUMN_HEADERS.map(() => ({ wch: 20 }))]

    XLSX.utils.book_append_sheet(wb, ws1, 'Détermination du marché cible')

    // ── Feuille 2 : Légende ────────────────────────────────────────────────
    const legendRows = [
      ['Valeur', 'Signification'],
      ['Positif', 'Marché cible positif : vente autorisée'],
      ['Neutre', 'Hors marché cible : diversification ou couverture du portefeuille'],
      ['Négatif', 'Marché cible négatif : vente interdite'],
      ['Oui', 'PAI pris en compte'],
      ['Non', 'PAI non pris en compte'],
      ['Non communiqué', 'Facteur de durabilité non communiqué par le producteur'],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(legendRows)
    ws2['!cols'] = [{ wch: 20 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Légende')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const date = new Date().toISOString().slice(0, 10)
    const filename = `Gouvernance_produits_${(cabinet?.name ?? 'cabinet').replace(/\s+/g, '_')}_${date}.xlsx`

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buf)
  })

  // ── GET /api/v1/products/governance/list ─────────────────────────────────
  app.get('/governance/list', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const items = await prisma.cabinetProductGovernance.findMany({
      where: { cabinetId: request.cabinetId, status: 'active' },
      include: { product: { select: { id: true, name: true, category: true } } },
      orderBy: { product: { name: 'asc' } },
    })
    return reply.send({ data: { items } })
  })

  // ── GET /api/v1/products/governance/due-revision ──────────────────────────
  app.get('/governance/due-revision', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const items = await prisma.cabinetProductGovernance.findMany({
      where: {
        cabinetId: request.cabinetId,
        status: 'active',
        nextRevisionDate: { lte: in30Days },
      },
      include: { product: { select: { id: true, name: true, category: true } } },
      orderBy: { nextRevisionDate: 'asc' },
    })
    return reply.send({ data: { items } })
  })

  // ── GET /api/v1/products/:id/governance ───────────────────────────────────
  app.get('/:id/governance', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const cabinetId = request.cabinetId

    const [active, draft, history] = await Promise.all([
      prisma.cabinetProductGovernance.findFirst({
        where: { cabinetId, productId: id, status: 'active' },
        orderBy: { revisionDate: 'desc' },
      }),
      prisma.cabinetProductGovernance.findFirst({
        where: { cabinetId, productId: id, status: 'draft' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cabinetProductGovernance.findMany({
        where: { cabinetId, productId: id, status: 'archived' },
        orderBy: { revisionDate: 'desc' },
      }),
    ])

    return reply.send({ data: { active, draft, history } })
  })

  // ── GET /api/v1/products/:id/governance/history ───────────────────────────
  app.get('/:id/governance/history', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const all = await prisma.cabinetProductGovernance.findMany({
      where: { cabinetId: request.cabinetId, productId: id },
      orderBy: { revisionDate: 'desc' },
    })
    return reply.send({ data: { history: all } })
  })

  // ── POST /api/v1/products/:id/governance (crée brouillon) ────────────────
  app.post('/:id/governance', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const cabinetId = request.cabinetId

    // Ensure cabinet_product link exists (upsert)
    await prisma.cabinetProduct.upsert({
      where: { cabinetId_productId: { cabinetId, productId: id } },
      create: { cabinetId, productId: id },
      update: {},
    })

    const result = governanceBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const gov = await prisma.cabinetProductGovernance.create({
      data: { cabinetId, productId: id, status: 'draft', ...result.data },
    })

    return reply.status(201).send({ data: { governance: gov } })
  })

  // ── PUT /api/v1/products/:id/governance/:govId (maj brouillon) ────────────
  app.put('/:id/governance/:govId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, govId } = request.params as { id: string; govId: string }
    const cabinetId = request.cabinetId

    const existing = await prisma.cabinetProductGovernance.findUnique({ where: { id: govId } })
    if (!existing || existing.cabinetId !== cabinetId || existing.productId !== id) {
      return reply.status(404).send({ error: 'Gouvernance introuvable', code: 'NOT_FOUND' })
    }
    if (existing.status !== 'draft') {
      return reply.status(400).send({ error: 'Seul un brouillon peut être modifié', code: 'NOT_DRAFT' })
    }

    const result = governanceBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const gov = await prisma.cabinetProductGovernance.update({
      where: { id: govId },
      data: result.data,
    })

    return reply.send({ data: { governance: gov } })
  })

  // ── POST /api/v1/products/:id/governance/:govId/activate ─────────────────
  app.post('/:id/governance/:govId/activate', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, govId } = request.params as { id: string; govId: string }
    const cabinetId = request.cabinetId

    const existing = await prisma.cabinetProductGovernance.findUnique({ where: { id: govId } })
    if (!existing || existing.cabinetId !== cabinetId || existing.productId !== id) {
      return reply.status(404).send({ error: 'Gouvernance introuvable', code: 'NOT_FOUND' })
    }
    if (existing.status !== 'draft') {
      return reply.status(400).send({ error: 'Seul un brouillon peut être activé', code: 'NOT_DRAFT' })
    }

    const revisionDate = new Date()
    const nextRevisionDate = new Date(revisionDate)
    nextRevisionDate.setFullYear(nextRevisionDate.getFullYear() + 1)

    const [gov] = await prisma.$transaction([
      // Activer le brouillon
      prisma.cabinetProductGovernance.update({
        where: { id: govId },
        data: {
          status: 'active',
          revisionDate,
          nextRevisionDate,
        },
      }),
      // Archiver les anciennes gouvernances actives
      prisma.cabinetProductGovernance.updateMany({
        where: { cabinetId, productId: id, status: 'active', id: { not: govId } },
        data: { status: 'archived' },
      }),
    ])

    return reply.send({ data: { governance: gov } })
  })

  // ── POST /api/v1/products/:id/governance/:govId/revise ───────────────────
  app.post('/:id/governance/:govId/revise', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, govId } = request.params as { id: string; govId: string }
    const cabinetId = request.cabinetId

    const existing = await prisma.cabinetProductGovernance.findUnique({ where: { id: govId } })
    if (!existing || existing.cabinetId !== cabinetId || existing.productId !== id) {
      return reply.status(404).send({ error: 'Gouvernance introuvable', code: 'NOT_FOUND' })
    }
    if (existing.status !== 'active') {
      return reply.status(400).send({ error: 'Seule une gouvernance active peut être révisée', code: 'NOT_ACTIVE' })
    }

    // Copier l'active en nouveau brouillon
    const { id: _id, status: _status, createdAt: _ca, updatedAt: _ua, revisionDate: _rd, nextRevisionDate: _nr, ...rest } = existing

    const draft = await prisma.cabinetProductGovernance.create({
      data: {
        ...rest,
        status: 'draft',
        revisionDate: new Date(),
        nextRevisionDate: null,
        notesRevision: null,
      },
    })

    return reply.status(201).send({ data: { governance: draft } })
  })

  // ── DELETE /api/v1/products/:id/governance/:govId ─────────────────────────
  app.delete('/:id/governance/:govId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, govId } = request.params as { id: string; govId: string }
    const cabinetId = request.cabinetId

    const existing = await prisma.cabinetProductGovernance.findUnique({ where: { id: govId } })
    if (!existing || existing.cabinetId !== cabinetId || existing.productId !== id) {
      return reply.status(404).send({ error: 'Gouvernance introuvable', code: 'NOT_FOUND' })
    }
    if (existing.status !== 'draft') {
      return reply.status(400).send({ error: 'Seul un brouillon peut être supprimé', code: 'NOT_DRAFT' })
    }

    await prisma.cabinetProductGovernance.delete({ where: { id: govId } })
    return reply.status(204).send()
  })
}
