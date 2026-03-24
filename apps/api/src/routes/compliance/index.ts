import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { adminMiddleware } from '../../middleware/admin'
import { prisma } from '../../lib/prisma'
import { runComplianceNotificationsJob } from '../../jobs/compliance-notifications'
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
    const { all } = request.query as { all?: string }
    const isAdmin = (request.user as any)?.globalRole === 'platform_admin'
    const includeInactive = all === 'true' && isAdmin

    const phases = await prisma.compliancePhase.findMany({
      where: includeInactive ? {} : { isActive: true },
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

      await prisma.$transaction(async (tx) => {
        const items = await tx.complianceItem.findMany({
          where: { phaseId },
          select: { id: true },
        })
        const itemIds = items.map((i) => i.id)

        if (itemIds.length > 0) {
          const answers = await tx.cabinetComplianceAnswer.findMany({
            where: { itemId: { in: itemIds } },
            select: { id: true },
          })
          const answerIds = answers.map((a) => a.id)

          if (answerIds.length > 0) {
            await tx.complianceNotification.deleteMany({ where: { answerId: { in: answerIds } } })
          }
          await tx.cabinetComplianceAnswer.deleteMany({ where: { itemId: { in: itemIds } } })
          await tx.complianceCondition.deleteMany({ where: { itemId: { in: itemIds } } })
          await tx.complianceCondition.deleteMany({ where: { dependsOnItemId: { in: itemIds } } })
          await tx.complianceItem.deleteMany({ where: { phaseId } })
        }

        await tx.compliancePhase.delete({ where: { id: phaseId } })
      })

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

  // ── Nombre de réponses pour un item (avant suppression) ───────────────────

  app.get(
    '/items/:itemId/answer-count',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { itemId } = request.params as { itemId: string }
      const count = await prisma.cabinetComplianceAnswer.count({
        where: { itemId, deletedAt: null },
      })
      return reply.send({ data: { count } })
    }
  )

  // ── POST /api/v1/compliance/admin/run-notifications ──────────────────────
  // Déclenche manuellement le job de notifications (platform_admin uniquement)
  app.post(
    '/admin/run-notifications',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (_request, reply) => {
      try {
        await runComplianceNotificationsJob()
        return reply.send({ data: { message: 'Job exécuté avec succès' } })
      } catch (err) {
        return reply.status(500).send({
          error: 'Erreur lors de l\'exécution du job',
          code: 'JOB_ERROR',
        })
      }
    }
  )

  // ══════════════════════════════════════════════════════════════════════════
  // PARTAGE D'ITEMS — cabinet → chamber / regulator
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/v1/compliance/shares — partager une sélection d'items à un ou plusieurs utilisateurs
  app.post(
    '/shares',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const body = z.object({
        itemIds: z.array(z.string().uuid()).min(1, 'Au moins un item requis'),
        recipientIds: z.array(z.string().uuid()).min(1, 'Au moins un destinataire requis'),
      }).safeParse(request.body)

      if (!body.success) {
        return reply.status(400).send({ error: body.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }

      const { itemIds, recipientIds } = body.data

      // Vérifie que les items existent
      const items = await prisma.complianceItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true },
      })
      if (items.length !== itemIds.length) {
        return reply.status(404).send({ error: 'Un ou plusieurs items introuvables', code: 'NOT_FOUND' })
      }

      // Vérifie que les destinataires existent et ont un rôle autorisé
      const recipients = await prisma.user.findMany({
        where: {
          id: { in: recipientIds },
          globalRole: { in: ['chamber', 'regulator', 'platform_admin'] },
        },
        select: { id: true },
      })
      if (recipients.length === 0) {
        return reply.status(400).send({ error: 'Aucun destinataire valide (rôle chamber ou regulator requis)', code: 'INVALID_RECIPIENTS' })
      }

      const validRecipientIds = recipients.map((r) => r.id)

      // Crée un share par item × par destinataire (idempotent avec upsert logique)
      const existingShares = await prisma.share.findMany({
        where: {
          cabinetId: request.cabinetId,
          grantedTo: { in: validRecipientIds },
          entityType: 'compliance_item',
          entityId: { in: itemIds },
          isActive: true,
        },
        select: { grantedTo: true, entityId: true },
      })

      const existingSet = new Set(existingShares.map((s) => `${s.grantedTo}:${s.entityId}`))

      const toCreate = validRecipientIds.flatMap((recipientId) =>
        itemIds
          .filter((itemId) => !existingSet.has(`${recipientId}:${itemId}`))
          .map((itemId) => ({
            cabinetId: request.cabinetId,
            grantedBy: request.user.id,
            grantedTo: recipientId,
            entityType: 'compliance_item' as const,
            entityId: itemId,
            isActive: true,
          }))
      )

      if (toCreate.length > 0) {
        await prisma.share.createMany({ data: toCreate })
      }

      return reply.status(201).send({
        data: {
          created: toCreate.length,
          skipped: existingShares.length,
        },
      })
    }
  )

  // GET /api/v1/compliance/shares — partages d'items accordés par ce cabinet
  app.get(
    '/shares',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const shares = await prisma.share.findMany({
        where: { cabinetId: request.cabinetId, entityType: 'compliance_item', isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
          recipientUser: { select: { id: true, email: true, globalRole: true } },
        },
      })

      // Récupère les labels des items
      const itemIds = [...new Set(shares.map((s) => s.entityId).filter(Boolean) as string[])]
      const items = await prisma.complianceItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, label: true, phase: { select: { label: true } } },
      })
      const itemsMap = new Map(items.map((i) => [i.id, i]))

      const enriched = shares.map((s) => ({
        ...s,
        item: s.entityId ? itemsMap.get(s.entityId) ?? null : null,
      }))

      return reply.send({ data: { shares: enriched } })
    }
  )

  // DELETE /api/v1/compliance/shares/:id — révoquer un partage d'item
  app.delete(
    '/shares/:id',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const share = await prisma.share.findFirst({
        where: { id, cabinetId: request.cabinetId, entityType: 'compliance_item' },
      })
      if (!share) {
        return reply.status(404).send({ error: 'Partage introuvable', code: 'NOT_FOUND' })
      }

      await prisma.share.update({ where: { id }, data: { isActive: false } })
      return reply.status(204).send()
    }
  )

  // GET /api/v1/compliance/shared-with-me — items partagés avec l'utilisateur connecté (chamber/regulator)
  app.get(
    '/shared-with-me',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const shares = await prisma.share.findMany({
        where: { grantedTo: request.user.id, entityType: 'compliance_item', isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
          cabinet: { select: { id: true, name: true, oriasNumber: true } },
        },
      })

      // Récupère items + réponses pour chaque share
      const itemIds = [...new Set(shares.map((s) => s.entityId).filter(Boolean) as string[])]
      const cabinetIds = [...new Set(shares.map((s) => s.cabinetId))]

      const [items, answers] = await Promise.all([
        prisma.complianceItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, label: true, type: true, phase: { select: { label: true } } },
        }),
        prisma.cabinetComplianceAnswer.findMany({
          where: { cabinetId: { in: cabinetIds }, itemId: { in: itemIds }, deletedAt: null },
          select: {
            cabinetId: true, itemId: true, value: true, status: true, submittedAt: true, expiresAt: true,
            document: { select: { id: true, name: true } },
          },
        }),
      ])

      const itemsMap = new Map(items.map((i) => [i.id, i]))
      const answersMap = new Map(answers.map((a) => [`${a.cabinetId}:${a.itemId}`, a]))

      // Groupe par cabinet
      const byCabinet = new Map<string, { cabinet: typeof shares[0]['cabinet']; items: object[] }>()
      for (const share of shares) {
        const item = share.entityId ? itemsMap.get(share.entityId) : null
        if (!item) continue
        const answer = share.entityId ? answersMap.get(`${share.cabinetId}:${share.entityId}`) ?? null : null
        const status = answer
          ? (answer.expiresAt && answer.expiresAt < new Date() ? 'expired'
            : answer.expiresAt && answer.expiresAt < new Date(Date.now() + 30 * 86400000) ? 'expiring_soon'
            : answer.status)
          : 'not_started'

        if (!byCabinet.has(share.cabinetId)) {
          byCabinet.set(share.cabinetId, { cabinet: share.cabinet, items: [] })
        }
        byCabinet.get(share.cabinetId)!.items.push({ shareId: share.id, item, answer, status })
      }

      return reply.send({ data: { cabinets: [...byCabinet.values()] } })
    }
  )
}
