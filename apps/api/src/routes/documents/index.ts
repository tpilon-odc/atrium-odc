import { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { DocumentEntityType, StorageMode } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import {
  uploadToMinio,
  deleteFromMinio,
  getPresignedUrl,
  buildStoragePath,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '../../lib/minio'
import {
  externalDocumentBody,
  updateDocumentBody,
  createDocumentLinkBody,
  listDocumentsQuery,
  addDocumentTagBody,
} from './schemas'

// Résout le nom lisible d'une entité pour le tagging automatique
async function resolveEntityName(entityType: string, entityId: string): Promise<string | null> {
  try {
    switch (entityType) {
      case 'contact': {
        const c = await prisma.contact.findUnique({ where: { id: entityId }, select: { firstName: true, lastName: true } })
        if (!c) return null
        return [c.firstName, c.lastName].filter(Boolean).join(' ') || null
      }
      case 'supplier': {
        const s = await prisma.supplier.findUnique({ where: { id: entityId }, select: { name: true } })
        return s?.name ?? null
      }
      case 'product': {
        const p = await prisma.product.findUnique({ where: { id: entityId }, select: { name: true } })
        return p?.name ?? null
      }
      case 'training': {
        const t = await prisma.collaboratorTraining.findUnique({
          where: { id: entityId },
          select: {
            user: { select: { firstName: true, lastName: true } },
            member: { select: { externalFirstName: true, externalLastName: true } },
          },
        })
        if (!t) return null
        if (t.user) return [t.user.firstName, t.user.lastName].filter(Boolean).join(' ') || null
        if (t.member) return [t.member.externalFirstName, t.member.externalLastName].filter(Boolean).join(' ') || null
        return null
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

export const documentRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } })

  // ── POST /api/v1/documents/upload ─────────────────────────────────────────
  // Paramètres optionnels :
  //   ?entityType=contact|supplier|product|training|compliance_answer
  //   ?entityId=<uuid>  (utilisé pour résoudre le nom de l'entité si tag entity_name configuré)
  app.post(
    '/upload',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const { entityType, entityId } = request.query as { entityType?: string; entityId?: string }

      const file = await request.file()
      if (!file) {
        return reply.status(400).send({ error: 'Aucun fichier reçu', code: 'NO_FILE' })
      }

      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return reply.status(400).send({
          error: `Type de fichier non autorisé : ${file.mimetype}`,
          code: 'INVALID_MIME_TYPE',
        })
      }

      const buffer = await file.toBuffer()

      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({ error: 'Fichier trop volumineux (max 10 Mo)', code: 'FILE_TOO_LARGE' })
      }

      // Résolution de la règle (dossier + tags auto)
      let folderId: string | undefined
      let tagNamesToApply: string[] = []

      if (entityType) {
        const rule = await prisma.folderRule.findUnique({
          where: { cabinetId_entityType: { cabinetId: request.cabinetId, entityType } },
          include: { tagRules: { orderBy: { order: 'asc' } } },
        })

        if (rule) {
          folderId = rule.folderId

          // Résolution du nom de l'entité pour les tags entity_name
          let entityName: string | null = null
          if (entityId && rule.tagRules.some((t) => t.type === 'entity_name')) {
            entityName = await resolveEntityName(entityType, entityId)
          }

          const year = new Date().getFullYear().toString()

          for (const tagRule of rule.tagRules) {
            if (tagRule.type === 'fixed' && tagRule.fixedValue) {
              tagNamesToApply.push(tagRule.fixedValue)
            } else if (tagRule.type === 'year') {
              tagNamesToApply.push(year)
            } else if (tagRule.type === 'entity_name' && entityName) {
              tagNamesToApply.push(entityName)
            }
          }
        }
      }

      const storagePath = buildStoragePath(request.cabinetId, file.filename)
      await uploadToMinio(storagePath, buffer, file.mimetype)

      const document = await prisma.$transaction(async (tx) => {
        const doc = await tx.document.create({
          data: {
            cabinetId: request.cabinetId,
            uploadedBy: request.user.id,
            name: file.filename,
            storageMode: StorageMode.hosted,
            storagePath,
            mimeType: file.mimetype,
            sizeBytes: BigInt(buffer.length),
            ...(folderId ? { folderId } : {}),
          },
        })

        // Upsert + association des tags automatiques
        for (const tagName of tagNamesToApply) {
          const tag = await tx.tag.upsert({
            where: { cabinetId_name: { cabinetId: request.cabinetId, name: tagName } },
            create: { cabinetId: request.cabinetId, name: tagName },
            update: {},
          })
          await tx.documentTag.upsert({
            where: { documentId_tagId: { documentId: doc.id, tagId: tag.id } },
            create: { documentId: doc.id, tagId: tag.id },
            update: {},
          })
        }

        return doc
      })

      return reply.status(201).send({ data: { document: { ...document, sizeBytes: document.sizeBytes?.toString() } } })
    }
  )

  // ── POST /api/v1/documents/external ───────────────────────────────────────
  app.post(
    '/external',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const result = externalDocumentBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }

      // Vérifie que la config appartient bien au cabinet
      const config = await prisma.cabinetStorageConfig.findFirst({
        where: { id: result.data.externalConfigId, cabinetId: request.cabinetId },
      })
      if (!config) {
        return reply.status(404).send({ error: 'Config de stockage introuvable', code: 'NOT_FOUND' })
      }

      const document = await prisma.document.create({
        data: {
          cabinetId: request.cabinetId,
          uploadedBy: request.user.id,
          name: result.data.name,
          description: result.data.description,
          storageMode: StorageMode.external,
          externalConfigId: result.data.externalConfigId,
          externalPath: result.data.externalPath,
          mimeType: result.data.mimeType,
        },
      })

      return reply.status(201).send({ data: { document } })
    }
  )

  // ── GET /api/v1/documents ─────────────────────────────────────────────────
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const query = listDocumentsQuery.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: query.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { cursor, limit, entityType, entityId, folderId, tagId } = query.data

    const where = {
      cabinetId: request.cabinetId,
      deletedAt: null,
      ...(entityType && entityId
        ? { links: { some: { entityType: entityType as any, entityId } } }
        : {}),
      ...(folderId !== undefined ? { folderId } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        take: limit + 1,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        where,
        orderBy: { createdAt: 'desc' },
        include: { links: true, tags: { include: { tag: true } } },
      }),
      prisma.document.count({ where }),
    ])

    const hasMore = documents.length > limit
    const items = hasMore ? documents.slice(0, limit) : documents
    const nextCursor = hasMore ? items[items.length - 1].id : null

    // BigInt → string pour la sérialisation JSON
    const data = items.map((d) => ({ ...d, sizeBytes: d.sizeBytes?.toString() ?? null }))

    return reply.send({ data: { documents: data, nextCursor, hasMore, total } })
  })

  // ── GET /api/v1/documents/:id ─────────────────────────────────────────────
  app.get('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const document = await prisma.document.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
      include: { links: true, externalConfig: true },
    })

    if (!document) {
      return reply.status(404).send({ error: 'Document introuvable', code: 'NOT_FOUND' })
    }

    return reply.send({ data: { document: { ...document, sizeBytes: document.sizeBytes?.toString() ?? null } } })
  })

  // ── GET /api/v1/documents/:id/shared-url ──────────────────────────────────
  // URL presignée pour un document partagé via un share compliance_item (sans cabinet)
  app.get('/:id/shared-url', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // Vérifie que l'utilisateur a un partage actif dont la réponse référence ce document
    const document = await prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: { externalConfig: true },
    })
    if (!document) {
      return reply.status(404).send({ error: 'Document introuvable', code: 'NOT_FOUND' })
    }

    // Cherche une réponse de conformité qui référence ce document et que cet utilisateur peut voir via un share
    const share = await prisma.share.findFirst({
      where: {
        grantedTo: request.user.id,
        entityType: 'compliance_item',
        isActive: true,
        cabinet: {
          complianceAnswers: {
            some: {
              value: { path: ['document_id'], equals: id },
              deletedAt: null,
            },
          },
        },
      },
    })
    if (!share) {
      return reply.status(403).send({ error: 'Accès non autorisé', code: 'FORBIDDEN' })
    }

    if (document.storageMode === StorageMode.hosted) {
      if (!document.storagePath) {
        return reply.status(500).send({ error: 'Chemin de stockage manquant', code: 'STORAGE_ERROR' })
      }
      const url = getPresignedUrl(document.storagePath)
      return reply.send({ data: { url, expiresIn: 3600 } })
    }

    if (!document.externalConfig || !document.externalPath) {
      return reply.status(500).send({ error: 'Config externe manquante', code: 'STORAGE_ERROR' })
    }
    const url = document.externalConfig.baseUrl + document.externalPath
    return reply.send({ data: { url, expiresIn: null } })
  })

  // ── GET /api/v1/documents/:id/url ─────────────────────────────────────────
  // Retourne une URL presignée (hosted) ou reconstituée (external)
  app.get('/:id/url', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const document = await prisma.document.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
      include: { externalConfig: true },
    })

    if (!document) {
      return reply.status(404).send({ error: 'Document introuvable', code: 'NOT_FOUND' })
    }

    if (document.storageMode === StorageMode.hosted) {
      if (!document.storagePath) {
        return reply.status(500).send({ error: 'Chemin de stockage manquant', code: 'STORAGE_ERROR' })
      }
      const url = getPresignedUrl(document.storagePath)
      return reply.send({ data: { url, expiresIn: 3600 } })
    }

    // Mode externe : URL = baseUrl + externalPath
    if (!document.externalConfig || !document.externalPath) {
      return reply.status(500).send({ error: 'Config externe manquante', code: 'STORAGE_ERROR' })
    }
    const url = document.externalConfig.baseUrl + document.externalPath
    return reply.send({ data: { url, expiresIn: null } })
  })

  // ── PATCH /api/v1/documents/:id ───────────────────────────────────────────
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = updateDocumentBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.document.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Document introuvable', code: 'NOT_FOUND' })
    }

    const document = await prisma.document.update({ where: { id }, data: result.data })
    return reply.send({ data: { document: { ...document, sizeBytes: document.sizeBytes?.toString() ?? null } } })
  })

  // ── DELETE /api/v1/documents/:id ──────────────────────────────────────────
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.document.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Document introuvable', code: 'NOT_FOUND' })
    }

    // Soft delete — le fichier MinIO est conservé (pour audit)
    await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } })
    return reply.status(204).send()
  })

  // ── POST /api/v1/documents/:id/links ─────────────────────────────────────
  app.post('/:id/links', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = createDocumentLinkBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.document.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Document introuvable', code: 'NOT_FOUND' })
    }

    const link = await prisma.documentLink.create({
      data: {
        documentId: id,
        entityType: result.data.entityType as DocumentEntityType,
        entityId: result.data.entityId,
        label: result.data.label,
      },
    })

    return reply.status(201).send({ data: { link } })
  })

  // ── DELETE /api/v1/documents/:id/links/:linkId ────────────────────────────
  app.delete('/:id/links/:linkId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, linkId } = request.params as { id: string; linkId: string }

    const link = await prisma.documentLink.findFirst({
      where: { id: linkId, documentId: id },
    })
    if (!link) {
      return reply.status(404).send({ error: 'Lien introuvable', code: 'NOT_FOUND' })
    }

    await prisma.documentLink.delete({ where: { id: linkId } })
    return reply.status(204).send()
  })

  // ── POST /api/v1/documents/:id/tags ──────────────────────────────────────
  app.post('/:id/tags', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.document.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Document introuvable', code: 'NOT_FOUND' })
    }

    const result = addDocumentTagBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { tagId } = result.data

    // Vérifie que le tag est accessible (système ou appartient au cabinet)
    const tag = await prisma.tag.findFirst({
      where: {
        id: tagId,
        OR: [{ cabinetId: null, isSystem: true }, { cabinetId: request.cabinetId }],
      },
    })
    if (!tag) {
      return reply.status(404).send({ error: 'Tag introuvable', code: 'NOT_FOUND' })
    }

    const documentTag = await prisma.documentTag.upsert({
      where: { documentId_tagId: { documentId: id, tagId } },
      create: { documentId: id, tagId },
      update: {},
      include: { tag: true },
    })

    return reply.status(201).send({ data: { documentTag } })
  })

  // ── DELETE /api/v1/documents/:id/tags/:tagId ─────────────────────────────
  app.delete('/:id/tags/:tagId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id, tagId } = request.params as { id: string; tagId: string }

    const existing = await prisma.document.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Document introuvable', code: 'NOT_FOUND' })
    }

    const documentTag = await prisma.documentTag.findFirst({
      where: { documentId: id, tagId },
    })
    if (!documentTag) {
      return reply.status(404).send({ error: 'Tag non attaché à ce document', code: 'NOT_FOUND' })
    }

    await prisma.documentTag.delete({ where: { documentId_tagId: { documentId: id, tagId } } })

    return reply.status(204).send()
  })
}
