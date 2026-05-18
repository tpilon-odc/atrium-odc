import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ShareEntityType } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { sendPushToUser } from '../../lib/webpush'

// ── Helper — notification in-app + push pour un nouveau partage ───────────────

const ENTITY_LABELS: Record<string, string> = {
  contact: 'contact',
  document: 'document',
  collaborator_training: 'formation',
  cabinet_compliance: 'conformité cabinet',
  compliance_item: 'item de conformité',
  cabinet: 'cabinet',
}

async function notifyShareRecipients(params: {
  recipientIds: string[]
  cabinetId: string
  cabinetName: string
  entityType: string
  count: number
}): Promise<void> {
  const { recipientIds, cabinetId, cabinetName, entityType, count } = params
  if (recipientIds.length === 0 || count === 0) return

  const label = ENTITY_LABELS[entityType] ?? entityType
  const title = `Nouveau partage — ${cabinetName}`
  const message = count === 1
    ? `Un ${label} a été partagé avec vous par ${cabinetName}.`
    : `${count} ${label}s ont été partagés avec vous par ${cabinetName}.`

  // In-app
  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      cabinetId,
      type: 'share_received',
      title,
      message,
      entityType: 'share',
      entityId: cabinetId,
    })),
    skipDuplicates: true,
  })

  // Push — fire and forget
  await Promise.all(
    recipientIds.map((userId) =>
      sendPushToUser(userId, { title, body: message, url: '/partage' }).catch(() => {})
    )
  )
}

const SHARE_ENTITY_TYPES = ['contact', 'document', 'collaborator_training', 'cabinet_compliance', 'cabinet', 'compliance_item'] as const

const createShareBody = z.object({
  grantedTo: z.string().uuid('grantedTo invalide'),
  entityType: z.enum(SHARE_ENTITY_TYPES),
  entityId: z.string().uuid().optional(),
})

const batchShareBody = z.object({
  entityType: z.enum(SHARE_ENTITY_TYPES),
  entityIds: z.array(z.string().uuid()).min(1),
  recipientIds: z.array(z.string().uuid()).min(1),
})

const batchAllContactsBody = z.object({
  recipientIds: z.array(z.string().uuid()).min(1),
})

const batchFolderBody = z.object({
  folderId: z.string().uuid(),
  recipientIds: z.array(z.string().uuid()).min(1),
})

export const shareRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/v1/shares ────────────────────────────────────────────────────
  // Partages accordés par ce cabinet (filtre optionnel par entityType)
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { entityType } = request.query as { entityType?: string }

    const shares = await prisma.share.findMany({
      where: {
        cabinetId: request.cabinetId,
        isActive: true,
        ...(entityType ? { entityType: entityType as ShareEntityType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        recipientUser: { select: { id: true, email: true, globalRole: true } },
      },
    })

    const enriched = await enrichShares(shares)
    return reply.send({ data: { shares: enriched } })
  })

  // ── POST /api/v1/shares/batch ─────────────────────────────────────────────
  // Crée N×M partages en une seule requête (idempotent)
  app.post('/batch', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = batchShareBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { entityType, entityIds, recipientIds } = result.data

    // Vérifie que les destinataires ont un rôle autorisé
    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientIds }, globalRole: { in: ['chamber', 'regulator', 'platform_admin', 'cabinet_user'] } },
      select: { id: true },
    })
    if (recipients.length === 0) {
      return reply.status(400).send({ error: 'Aucun destinataire valide', code: 'INVALID_RECIPIENTS' })
    }

    const validRecipientIds = recipients.map((r) => r.id)

    const existing = await prisma.share.findMany({
      where: {
        cabinetId: request.cabinetId,
        grantedTo: { in: validRecipientIds },
        entityType: entityType as ShareEntityType,
        entityId: { in: entityIds },
        isActive: true,
      },
      select: { grantedTo: true, entityId: true },
    })

    const existingSet = new Set(existing.map((s) => `${s.grantedTo}:${s.entityId}`))

    const toCreate = validRecipientIds.flatMap((recipientId) =>
      entityIds
        .filter((entityId) => !existingSet.has(`${recipientId}:${entityId}`))
        .map((entityId) => ({
          cabinetId: request.cabinetId,
          grantedBy: request.user.id,
          grantedTo: recipientId,
          entityType: entityType as ShareEntityType,
          entityId,
          isActive: true,
        }))
    )

    if (toCreate.length > 0) {
      await prisma.share.createMany({ data: toCreate })

      const cabinet = await prisma.cabinet.findUnique({ where: { id: request.cabinetId }, select: { name: true } })
      notifyShareRecipients({
        recipientIds: validRecipientIds,
        cabinetId: request.cabinetId,
        cabinetName: cabinet?.name ?? '',
        entityType,
        count: entityIds.length,
      }).catch(() => {})
    }

    return reply.status(201).send({ data: { created: toCreate.length, skipped: existing.length } })
  })

  // ── POST /api/v1/shares/batch-all-contacts ───────────────────────────────
  // Partage TOUS les contacts du cabinet avec les destinataires indiqués
  app.post('/batch-all-contacts', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = batchAllContactsBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { recipientIds } = result.data

    // Vérifie que les destinataires ont un rôle autorisé
    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientIds }, globalRole: { in: ['chamber', 'regulator', 'platform_admin', 'cabinet_user'] } },
      select: { id: true },
    })
    if (recipients.length === 0) {
      return reply.status(400).send({ error: 'Aucun destinataire valide', code: 'INVALID_RECIPIENTS' })
    }
    const validRecipientIds = recipients.map((r) => r.id)

    // Récupère tous les contacts du cabinet
    const contacts = await prisma.contact.findMany({
      where: { cabinetId: request.cabinetId },
      select: { id: true },
    })
    const contactIds = contacts.map((c) => c.id)

    if (contactIds.length === 0) {
      return reply.status(201).send({ data: { created: 0, skipped: 0, total: 0 } })
    }

    // Partages déjà existants
    const existing = await prisma.share.findMany({
      where: {
        cabinetId: request.cabinetId,
        grantedTo: { in: validRecipientIds },
        entityType: 'contact',
        entityId: { in: contactIds },
        isActive: true,
      },
      select: { grantedTo: true, entityId: true },
    })
    const existingSet = new Set(existing.map((s) => `${s.grantedTo}:${s.entityId}`))

    const toCreate = validRecipientIds.flatMap((recipientId) =>
      contactIds
        .filter((contactId) => !existingSet.has(`${recipientId}:${contactId}`))
        .map((contactId) => ({
          cabinetId: request.cabinetId,
          grantedBy: request.user.id,
          grantedTo: recipientId,
          entityType: 'contact' as const,
          entityId: contactId,
          isActive: true,
        }))
    )

    if (toCreate.length > 0) {
      await prisma.share.createMany({ data: toCreate })

      const cabinet = await prisma.cabinet.findUnique({ where: { id: request.cabinetId }, select: { name: true } })
      notifyShareRecipients({
        recipientIds: validRecipientIds,
        cabinetId: request.cabinetId,
        cabinetName: cabinet?.name ?? '',
        entityType: 'contact',
        count: contactIds.length,
      }).catch(() => {})
    }

    return reply.status(201).send({ data: { created: toCreate.length, skipped: existing.length, total: contactIds.length } })
  })

  // ── POST /api/v1/shares/batch-folder ─────────────────────────────────────
  // Partage tous les documents d'un dossier et ses sous-dossiers récursivement
  app.post('/batch-folder', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = batchFolderBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { folderId, recipientIds } = result.data

    // Vérifie que le dossier appartient au cabinet
    const rootFolder = await prisma.folder.findFirst({
      where: { id: folderId, cabinetId: request.cabinetId },
    })
    if (!rootFolder) {
      return reply.status(404).send({ error: 'Dossier introuvable', code: 'NOT_FOUND' })
    }

    // Vérifie destinataires
    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientIds }, globalRole: { in: ['chamber', 'regulator', 'platform_admin', 'cabinet_user'] } },
      select: { id: true },
    })
    if (recipients.length === 0) {
      return reply.status(400).send({ error: 'Aucun destinataire valide', code: 'INVALID_RECIPIENTS' })
    }
    const validRecipientIds = recipients.map((r) => r.id)

    // Collecte récursive de tous les IDs de sous-dossiers
    const allFolders = await prisma.folder.findMany({
      where: { cabinetId: request.cabinetId },
      select: { id: true, parentId: true },
    })

    function collectFolderIds(rootId: string): string[] {
      const ids = [rootId]
      for (const f of allFolders) {
        if (f.parentId === rootId) ids.push(...collectFolderIds(f.id))
      }
      return ids
    }
    const folderIds = collectFolderIds(folderId)

    // Récupère tous les documents dans ces dossiers
    const documents = await prisma.document.findMany({
      where: { cabinetId: request.cabinetId, folderId: { in: folderIds }, deletedAt: null },
      select: { id: true },
    })
    const documentIds = documents.map((d) => d.id)

    if (documentIds.length === 0) {
      return reply.status(201).send({ data: { created: 0, skipped: 0, total: 0 } })
    }

    // Partages déjà existants
    const existing = await prisma.share.findMany({
      where: {
        cabinetId: request.cabinetId,
        grantedTo: { in: validRecipientIds },
        entityType: 'document',
        entityId: { in: documentIds },
        isActive: true,
      },
      select: { grantedTo: true, entityId: true },
    })
    const existingSet = new Set(existing.map((s) => `${s.grantedTo}:${s.entityId}`))

    const toCreate = validRecipientIds.flatMap((recipientId) =>
      documentIds
        .filter((docId) => !existingSet.has(`${recipientId}:${docId}`))
        .map((docId) => ({
          cabinetId: request.cabinetId,
          grantedBy: request.user.id,
          grantedTo: recipientId,
          entityType: 'document' as const,
          entityId: docId,
          isActive: true,
        }))
    )

    if (toCreate.length > 0) {
      await prisma.share.createMany({ data: toCreate })

      const cabinet = await prisma.cabinet.findUnique({ where: { id: request.cabinetId }, select: { name: true } })
      notifyShareRecipients({
        recipientIds: validRecipientIds,
        cabinetId: request.cabinetId,
        cabinetName: cabinet?.name ?? '',
        entityType: 'document',
        count: documentIds.length,
      }).catch(() => {})
    }

    return reply.status(201).send({ data: { created: toCreate.length, skipped: existing.length, total: documentIds.length } })
  })

  // ── GET /api/v1/shares/received ───────────────────────────────────────────
  // Partages reçus par l'utilisateur connecté
  app.get('/received', { preHandler: [authMiddleware] }, async (request, reply) => {
    const shares = await prisma.share.findMany({
      where: { grantedTo: request.user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        granterUser: { select: { id: true, email: true } },
        cabinet: { select: { id: true, name: true } },
      },
    })

    const enriched = await enrichShares(shares)
    return reply.send({ data: { shares: enriched } })
  })

  // ── POST /api/v1/shares ───────────────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createShareBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    // Vérifie que le destinataire existe
    const recipient = await prisma.user.findUnique({ where: { id: result.data.grantedTo } })
    if (!recipient) {
      return reply.status(404).send({ error: 'Utilisateur destinataire introuvable', code: 'NOT_FOUND' })
    }

    // Évite les doublons actifs
    const existing = await prisma.share.findFirst({
      where: {
        cabinetId: request.cabinetId,
        grantedTo: result.data.grantedTo,
        entityType: result.data.entityType as ShareEntityType,
        entityId: result.data.entityId ?? null,
        isActive: true,
      },
    })
    if (existing) {
      return reply.status(409).send({ error: 'Ce partage existe déjà', code: 'DUPLICATE' })
    }

    const share = await prisma.share.create({
      data: {
        cabinetId: request.cabinetId,
        grantedBy: request.user.id,
        grantedTo: result.data.grantedTo,
        entityType: result.data.entityType as ShareEntityType,
        entityId: result.data.entityId,
      },
      include: {
        recipientUser: { select: { id: true, email: true } },
        cabinet: { select: { name: true } },
      },
    })

    notifyShareRecipients({
      recipientIds: [result.data.grantedTo],
      cabinetId: request.cabinetId,
      cabinetName: share.cabinet.name,
      entityType: result.data.entityType,
      count: 1,
    }).catch(() => {})

    return reply.status(201).send({ data: { share } })
  })

  // ── POST /api/v1/shares/:id/view ─────────────────────────────────────────
  // Enregistre une consultation (appelé par le destinataire)
  app.post('/:id/view', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const share = await prisma.share.findFirst({
      where: { id, grantedTo: request.user.id, isActive: true },
    })
    if (!share) {
      return reply.status(404).send({ error: 'Partage introuvable', code: 'NOT_FOUND' })
    }

    await prisma.shareViewLog.create({
      data: {
        shareId: id,
        viewerId: request.user.id,
        ipAddress: request.ip ?? null,
      },
    })

    return reply.status(204).send()
  })

  // ── GET /api/v1/shares/:id/views ─────────────────────────────────────────
  // Liste les consultations d'un partage (accessible au cabinet qui a partagé)
  app.get('/:id/views', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const share = await prisma.share.findFirst({
      where: { id, cabinetId: request.cabinetId },
    })
    if (!share) {
      return reply.status(404).send({ error: 'Partage introuvable', code: 'NOT_FOUND' })
    }

    const logs = await prisma.shareViewLog.findMany({
      where: { shareId: id },
      orderBy: { viewedAt: 'desc' },
      include: { viewer: { select: { id: true, email: true } } },
    })

    return reply.send({ data: { logs } })
  })

  // ── GET /api/v1/shares/views/summary ─────────────────────────────────────
  // Résumé des consultations pour tous les partages actifs du cabinet
  app.get('/views/summary', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const shares = await prisma.share.findMany({
      where: { cabinetId: request.cabinetId, isActive: true },
      include: {
        recipientUser: { select: { id: true, email: true, globalRole: true } },
        viewLogs: {
          orderBy: { viewedAt: 'desc' },
          take: 1,
          include: { viewer: { select: { id: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const enriched = await enrichShares(shares)
    return reply.send({ data: { shares: enriched } })
  })

  // ── DELETE /api/v1/shares/:id ─────────────────────────────────────────────
  // Révoque un partage
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.share.findFirst({
      where: { id, cabinetId: request.cabinetId, isActive: true },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Partage introuvable', code: 'NOT_FOUND' })
    }

    await prisma.share.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    })

    return reply.status(204).send()
  })
}

// ── Résolution des entités liées à une liste de shares ────────────────────────
async function enrichShares(shares: any[]) {
  const trainingIds = shares.filter((s) => s.entityType === 'collaborator_training' && s.entityId).map((s) => s.entityId!)
  const trainings = trainingIds.length > 0
    ? await prisma.collaboratorTraining.findMany({
        where: { id: { in: trainingIds }, deletedAt: null },
        include: {
          training: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          member: { select: { id: true, externalFirstName: true, externalLastName: true, externalEmail: true } },
          certificate: { select: { id: true, name: true, mimeType: true } },
          categoryHours: { select: { hours: true, category: { select: { name: true } } } },
        },
      })
    : []
  const trainingsById = new Map(trainings.map((t) => [t.id, t]))

  const documentIds = shares.filter((s) => s.entityType === 'document' && s.entityId).map((s) => s.entityId!)
  const documents = documentIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: documentIds }, deletedAt: null },
        select: {
          id: true, name: true, mimeType: true, sizeBytes: true, storageMode: true, folderId: true,
          folder: { select: { id: true, name: true, parentId: true } },
        },
      })
    : []
  const documentsById = new Map(documents.map((d) => [d.id, { ...d, sizeBytes: d.sizeBytes !== null ? String(d.sizeBytes) : null }]))

  const contactIds = shares.filter((s) => s.entityType === 'contact' && s.entityId).map((s) => s.entityId!)
  const contacts = contactIds.length > 0
    ? await prisma.contact.findMany({
        where: { id: { in: contactIds }, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, email: true, type: true },
      })
    : []
  const contactsById = new Map(contacts.map((c) => [c.id, c]))

  const complianceItemIds = shares.filter((s) => s.entityType === 'compliance_item' && s.entityId).map((s) => s.entityId!)
  const complianceItems = complianceItemIds.length > 0
    ? await prisma.complianceItem.findMany({
        where: { id: { in: complianceItemIds } },
        select: { id: true, label: true, type: true, phase: { select: { id: true, label: true } } },
      })
    : []
  const complianceItemsById = new Map(complianceItems.map((i) => [i.id, i]))

  const cabinetIds = [...new Set(shares.filter((s) => s.entityType === 'compliance_item').map((s) => s.cabinetId).filter(Boolean))]
  const complianceAnswers = complianceItemIds.length > 0 && cabinetIds.length > 0
    ? await prisma.cabinetComplianceAnswer.findMany({
        where: { itemId: { in: complianceItemIds }, cabinetId: { in: cabinetIds }, deletedAt: null },
        select: { itemId: true, cabinetId: true, value: true, status: true, submittedAt: true, expiresAt: true },
      })
    : []
  const complianceAnswersByKey = new Map(complianceAnswers.map((a) => [`${a.cabinetId}:${a.itemId}`, a]))

  return shares.map((s) => ({
    ...s,
    resolvedTraining: s.entityType === 'collaborator_training' && s.entityId ? trainingsById.get(s.entityId) ?? null : null,
    resolvedDocument: s.entityType === 'document' && s.entityId ? documentsById.get(s.entityId) ?? null : null,
    resolvedContact: s.entityType === 'contact' && s.entityId ? contactsById.get(s.entityId) ?? null : null,
    resolvedComplianceItem: s.entityType === 'compliance_item' && s.entityId
      ? (() => {
          const item = complianceItemsById.get(s.entityId) ?? null
          const answer = s.cabinetId ? complianceAnswersByKey.get(`${s.cabinetId}:${s.entityId}`) ?? null : null
          return item ? { item, answer } : null
        })()
      : null,
  }))
}
