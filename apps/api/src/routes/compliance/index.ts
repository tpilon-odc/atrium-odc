import { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { adminMiddleware } from '../../middleware/admin'
import { prisma } from '../../lib/prisma'
import { calculateItemStatus, calculatePhaseProgress } from './helpers'
import {
  createPhaseBody,
  updatePhaseBody,
  createItemBody,
  updateItemBody,
  createConditionBody,
  submitAnswerBody,
} from './schemas'

export const complianceRoutes: FastifyPluginAsync = async (app) => {
  // ══════════════════════════════════════════════════════════════════════════
  // ROUTES COMMUNES — Phases + Items (lecture ouverte à tous les authentifiés)
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/compliance/phases — structure complète
  app.get('/phases', { preHandler: [authMiddleware] }, async (request, reply) => {
    const phases = await prisma.compliancePhase.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { conditions: true },
        },
      },
    })
    return reply.send({ data: { phases } })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ROUTES CABINET — Réponses et progression
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/compliance/progress — progression complète du cabinet
  app.get(
    '/progress',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const [phases, answers] = await Promise.all([
        prisma.compliancePhase.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            items: {
              orderBy: { order: 'asc' },
              include: { conditions: true },
            },
          },
        }),
        prisma.cabinetComplianceAnswer.findMany({
          where: { cabinetId: request.cabinetId, deletedAt: null },
        }),
      ])

      const answersByItemId = new Map(answers.map((a) => [a.itemId, a]))

      const phasesWithProgress = phases.map((phase) => {
        const itemsWithStatus = phase.items.map((item) => {
          const answer = answersByItemId.get(item.id) ?? null
          const status = calculateItemStatus(answer)
          return {
            ...item,
            status,
            answer: answer
              ? {
                  id: answer.id,
                  value: answer.value,
                  status: answer.status,
                  submittedAt: answer.submittedAt,
                  expiresAt: answer.expiresAt,
                  updatedAt: answer.updatedAt,
                }
              : null,
          }
        })

        const progress = calculatePhaseProgress(itemsWithStatus)
        return { ...phase, name: phase.label, items: itemsWithStatus, progress }
      })

      // Progression globale = moyenne des progressions des phases actives
      const totalRequired = phasesWithProgress.flatMap((p) =>
        p.items.filter((i) => i.isRequired)
      )
      const totalCompleted = totalRequired.filter((i) =>
        ['submitted', 'expiring_soon'].includes(i.status)
      )
      const globalProgress =
        totalRequired.length > 0
          ? Math.round((totalCompleted.length / totalRequired.length) * 100)
          : 100

      return reply.send({ data: { globalProgress, phases: phasesWithProgress } })
    }
  )

  // PUT /api/v1/compliance/answers/:itemId — soumettre ou mettre à jour une réponse
  app.put(
    '/answers/:itemId',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { itemId } = request.params as { itemId: string }

      const result = submitAnswerBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({
          error: result.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        })
      }

      const { value, status } = result.data

      const item = await prisma.complianceItem.findUnique({ where: { id: itemId } })
      if (!item) {
        return reply.status(404).send({ error: 'Item introuvable', code: 'NOT_FOUND' })
      }

      // Calcul de expiresAt si l'item est soumis et a une durée de validité
      let expiresAt: Date | null = null
      const now = new Date()
      if (status === 'submitted' && item.validityMonths) {
        expiresAt = new Date(now)
        expiresAt.setMonth(expiresAt.getMonth() + item.validityMonths)
      }

      const submittedAt = status === 'submitted' ? now : null

      // Upsert : une seule réponse par cabinet par item
      const existing = await prisma.cabinetComplianceAnswer.findFirst({
        where: { cabinetId: request.cabinetId, itemId, deletedAt: null },
      })

      const answer = existing
        ? await prisma.cabinetComplianceAnswer.update({
            where: { id: existing.id },
            data: { value: value as object, status, submittedAt, expiresAt },
          })
        : await prisma.cabinetComplianceAnswer.create({
            data: {
              cabinetId: request.cabinetId,
              itemId,
              answeredBy: request.user.id,
              value: value as object,
              status,
              submittedAt,
              expiresAt,
            },
          })

      return reply.send({ data: { answer } })
    }
  )

  // GET /api/v1/compliance/answers — toutes les réponses du cabinet
  app.get(
    '/answers',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const answers = await prisma.cabinetComplianceAnswer.findMany({
        where: { cabinetId: request.cabinetId, deletedAt: null },
        include: { item: { select: { label: true, type: true, validityMonths: true } } },
      })

      const answersWithStatus = answers.map((a) => ({
        ...a,
        computedStatus: calculateItemStatus(a),
      }))

      return reply.send({ data: { answers: answersWithStatus } })
    }
  )

  // ══════════════════════════════════════════════════════════════════════════
  // ROUTES ADMIN — CRUD Phases
  // ══════════════════════════════════════════════════════════════════════════

  app.post(
    '/phases',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const result = createPhaseBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }
      const phase = await prisma.compliancePhase.create({ data: result.data })
      return reply.status(201).send({ data: { phase } })
    }
  )

  app.patch(
    '/phases/:phaseId',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { phaseId } = request.params as { phaseId: string }
      const result = updatePhaseBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }
      const phase = await prisma.compliancePhase.update({ where: { id: phaseId }, data: result.data })
      return reply.send({ data: { phase } })
    }
  )

  app.delete(
    '/phases/:phaseId',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { phaseId } = request.params as { phaseId: string }
      await prisma.compliancePhase.update({ where: { id: phaseId }, data: { isActive: false } })
      return reply.status(204).send()
    }
  )

  // ── CRUD Items ────────────────────────────────────────────────────────────

  app.post(
    '/phases/:phaseId/items',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { phaseId } = request.params as { phaseId: string }
      const result = createItemBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }
      const item = await prisma.complianceItem.create({
        data: { ...result.data, phaseId, config: result.data.config as object },
      })
      return reply.status(201).send({ data: { item } })
    }
  )

  app.patch(
    '/items/:itemId',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { itemId } = request.params as { itemId: string }
      const result = updateItemBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }
      const data = result.data.config
        ? { ...result.data, config: result.data.config as object }
        : result.data
      const item = await prisma.complianceItem.update({ where: { id: itemId }, data })
      return reply.send({ data: { item } })
    }
  )

  app.delete(
    '/items/:itemId',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { itemId } = request.params as { itemId: string }
      await prisma.complianceItem.delete({ where: { id: itemId } })
      return reply.status(204).send()
    }
  )

  // ── Conditions ────────────────────────────────────────────────────────────

  app.post(
    '/conditions',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const result = createConditionBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }
      const condition = await prisma.complianceCondition.create({ data: result.data })
      return reply.status(201).send({ data: { condition } })
    }
  )

  app.delete(
    '/conditions/:conditionId',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { conditionId } = request.params as { conditionId: string }
      await prisma.complianceCondition.delete({ where: { id: conditionId } })
      return reply.status(204).send()
    }
  )
}
