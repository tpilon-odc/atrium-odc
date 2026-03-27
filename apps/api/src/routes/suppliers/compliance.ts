import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { CHECKLIST_BY_TYPE, initChecklist } from '../../lib/supplier-checklist'

const VALID_CRITERES = ['solvabilite', 'reputation', 'moyens', 'relation', 'remuneration'] as const

const evaluationNoteSchema = z.object({
  critere_id: z.enum(VALID_CRITERES),
  note: z.number().min(1).max(5),
  commentaire: z.string().optional(),
})

function computeScoreGlobal(notes: { note: number }[]): number {
  const vals = notes.filter((n) => n.note > 0).map((n) => n.note)
  if (!vals.length) return 0
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
}

const upsertVerificationBody = z.object({
  supplierType: z.enum([
    'sgp', 'psi', 'psfp', 'psan', 'biens_divers', 'cif_plateforme', 'promoteur_non_regule',
  ]),
  checklist: z.array(z.object({
    key: z.string(),
    completed: z.boolean(),
    mode: z.enum(['document', 'online', 'na']).nullable(),
    document_id: z.string().uuid().nullable(),
    verified_url: z.string().nullable(),
  })).optional(),
  beneficiairesVerifies: z.boolean().optional(),
  beneficiairesSource: z.string().nullable().optional(),
})

const decideBody = z.object({
  decision: z.enum(['approved', 'rejected', 'pending']),
  decisionNote: z.string().nullable().optional(),
  verificationDate: z.string().optional(), // ISO date
})

const upsertEvaluationBody = z.object({
  evaluationNotes: z.array(evaluationNoteSchema).optional(),
  evaluationDate: z.string().optional(),
  evaluateurs: z.array(z.string()).optional(),
  contratSigneLe: z.string().nullable().optional(),
  contratDuree: z.string().nullable().optional(),
  contratPreavis: z.string().nullable().optional(),
  contratDocumentId: z.string().uuid().nullable().optional(),
})

export const supplierComplianceRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /api/v1/suppliers/:id/verification ────────────────────────────────
  app.get('/:id/verification', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const verification = await prisma.cabinetSupplierVerification.findUnique({
      where: { cabinetId_supplierId: { cabinetId: request.cabinetId, supplierId: id } },
    })

    return reply.send({ data: { verification } })
  })

  // ── PUT /api/v1/suppliers/:id/verification ────────────────────────────────
  app.put('/:id/verification', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = upsertVerificationBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { supplierType, checklist, beneficiairesVerifies, beneficiairesSource } = result.data

    // Si le type change on réinitialise la checklist
    const existing = await prisma.cabinetSupplierVerification.findUnique({
      where: { cabinetId_supplierId: { cabinetId: request.cabinetId, supplierId: id } },
    })

    let resolvedChecklist = checklist
    if (!resolvedChecklist || (existing && existing.supplierType !== supplierType)) {
      resolvedChecklist = initChecklist(supplierType as any)
    }

    const verification = await prisma.cabinetSupplierVerification.upsert({
      where: { cabinetId_supplierId: { cabinetId: request.cabinetId, supplierId: id } },
      create: {
        cabinetId: request.cabinetId,
        supplierId: id,
        supplierType,
        checklist: resolvedChecklist as any,
        beneficiairesVerifies: beneficiairesVerifies ?? false,
        beneficiairesSource: beneficiairesSource ?? null,
      },
      update: {
        supplierType,
        checklist: resolvedChecklist as any,
        ...(beneficiairesVerifies !== undefined ? { beneficiairesVerifies } : {}),
        ...(beneficiairesSource !== undefined ? { beneficiairesSource } : {}),
      },
    })

    return reply.send({ data: { verification } })
  })

  // ── POST /api/v1/suppliers/:id/verification/decide ────────────────────────
  app.post('/:id/verification/decide', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = decideBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const verification = await prisma.cabinetSupplierVerification.findUnique({
      where: { cabinetId_supplierId: { cabinetId: request.cabinetId, supplierId: id } },
    })
    if (!verification) {
      return reply.status(404).send({ error: 'Vérification introuvable', code: 'NOT_FOUND' })
    }

    const updated = await prisma.cabinetSupplierVerification.update({
      where: { cabinetId_supplierId: { cabinetId: request.cabinetId, supplierId: id } },
      data: {
        decision: result.data.decision,
        decisionNote: result.data.decisionNote ?? null,
        verificationDate: result.data.verificationDate ? new Date(result.data.verificationDate) : new Date(),
        verifiedBy: request.user.id,
      },
    })

    return reply.send({ data: { verification: updated } })
  })

  // ── GET /api/v1/suppliers/:id/evaluations ─────────────────────────────────
  app.get('/:id/evaluations', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const evaluations = await prisma.cabinetSupplierEvaluation.findMany({
      where: { cabinetId: request.cabinetId, supplierId: id },
      orderBy: { evaluationDate: 'desc' },
    })

    return reply.send({ data: { evaluations } })
  })

  // ── POST /api/v1/suppliers/:id/evaluations ────────────────────────────────
  app.post('/:id/evaluations', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = upsertEvaluationBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const evalDate = result.data.evaluationDate ? new Date(result.data.evaluationDate) : new Date()
    const nextReviewDate = new Date(evalDate)
    nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1)

    const notes = result.data.evaluationNotes ?? []
    const scoreGlobal = computeScoreGlobal(notes)

    const evaluation = await prisma.cabinetSupplierEvaluation.create({
      data: {
        cabinetId: request.cabinetId,
        supplierId: id,
        evaluationNotes: notes as any,
        scoreGlobal,
        evaluationDate: evalDate,
        nextReviewDate,
        evaluateurs: result.data.evaluateurs ?? [],
        contratSigneLe: result.data.contratSigneLe ? new Date(result.data.contratSigneLe) : null,
        contratDuree: result.data.contratDuree ?? null,
        contratPreavis: result.data.contratPreavis ?? null,
        contratDocumentId: result.data.contratDocumentId ?? null,
      },
    })

    return reply.status(201).send({ data: { evaluation } })
  })

  // ── PUT /api/v1/suppliers/:id/evaluations/:evalId ─────────────────────────
  app.put('/:id/evaluations/:evalId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, evalId } = request.params as { id: string; evalId: string }

    const existing = await prisma.cabinetSupplierEvaluation.findFirst({
      where: { id: evalId, cabinetId: request.cabinetId, supplierId: id },
    })
    if (!existing) return reply.status(404).send({ error: 'Évaluation introuvable', code: 'NOT_FOUND' })
    if (existing.status === 'completed') {
      return reply.status(400).send({ error: 'Une évaluation finalisée ne peut pas être modifiée', code: 'IMMUTABLE' })
    }

    const result = upsertEvaluationBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const notes = result.data.evaluationNotes ?? (existing.evaluationNotes as any[] ?? [])
    const scoreGlobal = computeScoreGlobal(notes)

    const evaluation = await prisma.cabinetSupplierEvaluation.update({
      where: { id: evalId },
      data: {
        evaluationNotes: notes as any,
        scoreGlobal,
        evaluationDate: result.data.evaluationDate ? new Date(result.data.evaluationDate) : undefined,
        evaluateurs: result.data.evaluateurs,
        contratSigneLe: result.data.contratSigneLe !== undefined ? (result.data.contratSigneLe ? new Date(result.data.contratSigneLe) : null) : undefined,
        contratDuree: result.data.contratDuree,
        contratPreavis: result.data.contratPreavis,
        contratDocumentId: result.data.contratDocumentId,
      },
    })

    return reply.send({ data: { evaluation } })
  })

  // ── POST /api/v1/suppliers/:id/evaluations/:evalId/complete ───────────────
  app.post('/:id/evaluations/:evalId/complete', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, evalId } = request.params as { id: string; evalId: string }

    const existing = await prisma.cabinetSupplierEvaluation.findFirst({
      where: { id: evalId, cabinetId: request.cabinetId, supplierId: id },
    })
    if (!existing) return reply.status(404).send({ error: 'Évaluation introuvable', code: 'NOT_FOUND' })
    if (existing.status === 'completed') {
      return reply.status(400).send({ error: 'Évaluation déjà finalisée', code: 'ALREADY_COMPLETED' })
    }

    const evalDate = existing.evaluationDate
    const nextReviewDate = new Date(evalDate)
    nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1)

    const evaluation = await prisma.cabinetSupplierEvaluation.update({
      where: { id: evalId },
      data: { status: 'completed', nextReviewDate },
    })

    return reply.send({ data: { evaluation } })
  })

  // ── GET /api/v1/suppliers/evaluations/due-review ──────────────────────────
  // Liste les fournisseurs dont la prochaine révision est dans <= 30j
  app.get('/evaluations/due-review', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const in30days = new Date()
    in30days.setDate(in30days.getDate() + 30)

    const evaluations = await prisma.cabinetSupplierEvaluation.findMany({
      where: {
        cabinetId: request.cabinetId,
        status: 'completed',
        nextReviewDate: { lte: in30days },
      },
      orderBy: { nextReviewDate: 'asc' },
      include: {
        supplier: { select: { id: true, name: true, category: true } },
      },
    })

    return reply.send({ data: { evaluations } })
  })
}
