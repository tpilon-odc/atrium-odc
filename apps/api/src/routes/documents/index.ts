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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require('pdf-parse')
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

// Crée ou retrouve un sous-dossier par son nom dans un parent donné (upsert par cabinetId+parentId+name)
async function upsertSubfolder(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  cabinetId: string,
  parentId: string,
  name: string
): Promise<string> {
  const existing = await tx.folder.findFirst({
    where: { cabinetId, parentId, name },
    select: { id: true },
  })
  if (existing) return existing.id
  const created = await tx.folder.create({
    data: { cabinetId, parentId, name, isSystem: false },
    select: { id: true },
  })
  return created.id
}

// Résout le folderId final en créant les sous-dossiers dynamiques si nécessaire
async function resolveTargetFolder(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  cabinetId: string,
  rule: { folderId: string; subfolderEntity: boolean; subfolderYear: boolean; subfolderOrder: string },
  entityName: string | null
): Promise<string> {
  const year = new Date().getFullYear().toString()

  const steps: Array<{ active: boolean; name: string | null }> =
    rule.subfolderOrder === 'year_entity'
      ? [
          { active: rule.subfolderYear, name: year },
          { active: rule.subfolderEntity, name: entityName },
        ]
      : [
          { active: rule.subfolderEntity, name: entityName },
          { active: rule.subfolderYear, name: year },
        ]

  let currentParentId = rule.folderId
  for (const step of steps) {
    if (step.active && step.name) {
      currentParentId = await upsertSubfolder(tx, cabinetId, currentParentId, step.name)
    }
  }
  return currentParentId
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

      // Résolution de la règle (dossier + sous-dossiers dynamiques + tags auto)
      let resolvedRule: {
        folderId: string
        subfolderEntity: boolean
        subfolderYear: boolean
        subfolderOrder: string
        tagRules: { type: string; fixedValue: string | null }[]
      } | null = null
      let entityName: string | null = null
      let tagNamesToApply: string[] = []

      if (entityType) {
        resolvedRule = await prisma.folderRule.findUnique({
          where: { cabinetId_entityType: { cabinetId: request.cabinetId, entityType } },
          select: {
            folderId: true,
            subfolderEntity: true,
            subfolderYear: true,
            subfolderOrder: true,
            tagRules: { select: { type: true, fixedValue: true }, orderBy: { order: 'asc' } },
          },
        })

        if (resolvedRule && entityId) {
          const needsName =
            resolvedRule.subfolderEntity ||
            resolvedRule.tagRules.some((t) => t.type === 'entity_name')
          if (needsName) entityName = await resolveEntityName(entityType, entityId)
        }

        if (resolvedRule) {
          const year = new Date().getFullYear().toString()
          for (const tagRule of resolvedRule.tagRules) {
            if (tagRule.type === 'fixed' && tagRule.fixedValue) tagNamesToApply.push(tagRule.fixedValue)
            else if (tagRule.type === 'year') tagNamesToApply.push(year)
            else if (tagRule.type === 'entity_name' && entityName) tagNamesToApply.push(entityName)
          }
        }
      }

      const storagePath = buildStoragePath(request.cabinetId, file.filename)
      await uploadToMinio(storagePath, buffer, file.mimetype)

      const document = await prisma.$transaction(async (tx) => {
        // Résolution du dossier final (sous-dossiers dynamiques créés si nécessaire)
        let folderId: string | undefined
        if (resolvedRule) {
          folderId = await resolveTargetFolder(tx, request.cabinetId, resolvedRule, entityName)
        }

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

    // Vérifie l'accès : share direct sur le document OU share compliance_item lié au document
    const directShare = await prisma.share.findFirst({
      where: {
        grantedTo: request.user.id,
        entityType: 'document',
        entityId: id,
        isActive: true,
      },
    })

    if (!directShare) {
      const complianceShare = await prisma.share.findFirst({
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

      if (!complianceShare) {
        // Certificat d'une formation partagée — cherche directement une formation partagée avec ce certificat
        const trainingShareWithCert = await prisma.share.findFirst({
          where: {
            grantedTo: request.user.id,
            entityType: 'collaborator_training',
            isActive: true,
            entityId: {
              in: await prisma.collaboratorTraining.findMany({
                where: { certificateDocumentId: id, deletedAt: null },
                select: { id: true },
              }).then((rows) => rows.map((r) => r.id)),
            },
          },
        })

        if (!trainingShareWithCert) {
          return reply.status(403).send({ error: 'Accès non autorisé', code: 'FORBIDDEN' })
        }
      }
    }

    if (document.storageMode === StorageMode.hosted) {
      if (!document.storagePath) {
        return reply.status(500).send({ error: 'Chemin de stockage manquant', code: 'STORAGE_ERROR' })
      }
      const url = await getPresignedUrl(document.storagePath)
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
      const url = await getPresignedUrl(document.storagePath)
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

  // ── POST /api/v1/documents/upload-cabinet-doc ─────────────────────────────
  // Upload un PDF cabinet (KBIS, ORIAS, CNCGP), le range dans la GED selon les règles
  // configurées pour entityType=cabinet_document, puis extrait les champs reconnus.
  app.post(
    '/upload-cabinet-doc',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const file = await request.file()
      if (!file) return reply.status(400).send({ error: 'Aucun fichier reçu', code: 'NO_FILE' })

      if (file.mimetype !== 'application/pdf') {
        return reply.status(400).send({ error: 'Seuls les fichiers PDF sont acceptés', code: 'INVALID_MIME_TYPE' })
      }

      const buffer = await file.toBuffer()
      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({ error: 'Fichier trop volumineux (max 10 Mo)', code: 'FILE_TOO_LARGE' })
      }

      // Résolution du dossier cible : règle GED cabinet_document en priorité,
      // sinon fallback sur le dossier système "Conformité" du cabinet
      const resolvedRule = await prisma.folderRule.findUnique({
        where: { cabinetId_entityType: { cabinetId: request.cabinetId, entityType: 'cabinet_document' } },
        select: {
          folderId: true,
          subfolderEntity: true,
          subfolderYear: true,
          subfolderOrder: true,
          tagRules: { select: { type: true, fixedValue: true }, orderBy: { order: 'asc' } },
        },
      })

      let fallbackFolderId: string | undefined
      if (!resolvedRule) {
        const conformiteFolder = await prisma.folder.findFirst({
          where: { cabinetId: request.cabinetId, name: 'Conformité', isSystem: true },
          select: { id: true },
        })
        fallbackFolderId = conformiteFolder?.id
      }

      // Extraction avant la transaction pour connaître le type et tagger le doc
      let extracted: CabinetDocResult = { extractable: false }
      try {
        const pdf = await pdfParse(buffer)
        extracted = parseCabinetDoc(pdf.text)
      } catch {
        // extraction optionnelle — on continue même si ça échoue
      }

      const docTypeTag = extracted.extractable ? extracted.docType : undefined

      const storagePath = buildStoragePath(request.cabinetId, file.filename)
      await uploadToMinio(storagePath, buffer, file.mimetype)

      const document = await prisma.$transaction(async (tx) => {
        let folderId: string | undefined = fallbackFolderId
        if (resolvedRule) {
          const year = new Date().getFullYear().toString()
          let currentParentId = resolvedRule.folderId
          const steps =
            resolvedRule.subfolderOrder === 'year_entity'
              ? [{ active: resolvedRule.subfolderYear, name: year }]
              : [{ active: resolvedRule.subfolderYear, name: year }]
          for (const step of steps) {
            if (step.active && step.name) currentParentId = await upsertSubfolder(tx, request.cabinetId, currentParentId, step.name)
          }
          folderId = currentParentId
        }

        // Soft-delete du doc précédent du même type (si type détecté)
        if (docTypeTag) {
          const typeTag = await tx.tag.findFirst({
            where: { cabinetId: request.cabinetId, name: docTypeTag },
          })
          if (typeTag) {
            const previousDocs = await tx.document.findMany({
              where: {
                cabinetId: request.cabinetId,
                deletedAt: null,
                tags: { some: { tagId: typeTag.id } },
              },
              select: { id: true },
            })
            if (previousDocs.length > 0) {
              await tx.document.updateMany({
                where: { id: { in: previousDocs.map((d) => d.id) } },
                data: { deletedAt: new Date() },
              })
            }
          }
        }

        const doc = await tx.document.create({
          data: {
            cabinetId: request.cabinetId,
            uploadedBy: request.user.id,
            name: file.filename,
            storageMode: 'hosted',
            storagePath,
            mimeType: file.mimetype,
            sizeBytes: BigInt(buffer.length),
            ...(folderId ? { folderId } : {}),
          },
        })

        // Tags : règle GED + tag type de document
        const year = new Date().getFullYear().toString()
        const tagNames: string[] = []
        if (resolvedRule) {
          for (const tagRule of resolvedRule.tagRules) {
            if (tagRule.type === 'fixed' && tagRule.fixedValue) tagNames.push(tagRule.fixedValue)
            else if (tagRule.type === 'year') tagNames.push(year)
          }
        }
        if (docTypeTag) tagNames.push(docTypeTag)

        for (const tagName of tagNames) {
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

      return reply.status(201).send({
        data: { document: { ...document, sizeBytes: document.sizeBytes?.toString() }, ...extracted },
      })
    }
  )
}

// ── Détection et parsing multi-documents cabinet ──────────────────────────────
type CabinetDocResult =
  | { extractable: false }
  | ({ extractable: true; docType: 'kbis' } & KbisFields)
  | ({ extractable: true; docType: 'orias' } & OriasFields)
  | ({ extractable: true; docType: 'cncgp' } & CncgpFields)

type KbisFields = {
  name?: string; siret?: string; siren?: string; formeJuridique?: string
  adresse?: string; ville?: string; codePostal?: string; capital?: string; dateImmatriculation?: string
}
type OriasFields = {
  name?: string; siren?: string; oriasNumber?: string; adresse?: string
  ville?: string; codePostal?: string; categories?: string[]; validiteJusquau?: string
}
type CncgpFields = {
  name?: string; siren?: string; oriasNumber?: string; categories?: string[]; dateAdhesion?: string
}

function parseCabinetDoc(rawText: string): CabinetDocResult {
  const t = rawText.replace(/\u00A0/g, ' ').replace(/\r/g, '\n')

  if (/Extrait\s+Kbis|EXTRAIT\s+D.IMMATRICULATION/i.test(t)) return { extractable: true, docType: 'kbis', ...parseKbis(t) }
  if (/L.Orias\s+certifie|Registre\s+unique\s+des\s+interm/i.test(t)) return { extractable: true, docType: 'orias', ...parseOrias(t) }
  // Le PDF CNCGP peut avoir les mots collés (problème de police) — on teste avec et sans espaces
  if (/Chambre\s*Nationale\s*des\s*Conseils\s*en\s*Gestion\s*de\s*Patrimoine|CNCGP|ATTESTATION\s*D.ADHESION/i.test(t)) return { extractable: true, docType: 'cncgp', ...parseCncgp(t) }

  return { extractable: false }
}

function extractSiren(t: string): { siren?: string; siret?: string } {
  // KBIS : "979 761 467 R.C.S." — ORIAS/CNCGP : "RCS 979761467" ou "979761467"
  const rcsMatch = t.match(/(?:RCS\b[^\d]*|)(\d{3}[\s]?\d{3}[\s]?\d{3})\b/)
  if (rcsMatch) {
    const raw = rcsMatch[1].replace(/\s/g, '')
    if (raw.length === 9) return { siren: raw }
  }
  const siretMatch = t.match(/\b(\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5})\b/)
  if (siretMatch) {
    const raw = siretMatch[1].replace(/[\s.]/g, '')
    if (raw.length === 14) return { siret: raw, siren: raw.substring(0, 9) }
  }
  return {}
}

function parseKbis(t: string): KbisFields {
  const result: KbisFields = {}

  const sirenMatch = t.match(/\b(\d{3}\s\d{3}\s\d{3})\s+R\.?C\.?S\b/i)
    ?? t.match(/numéro\s+(\d{3}[\s]?\d{3}[\s]?\d{3})\s+R\.?C\.?S/i)
  if (sirenMatch) {
    const raw = sirenMatch[1].replace(/\s/g, '')
    result.siren = raw
    result.siret = raw
  } else {
    const fb = extractSiren(t)
    Object.assign(result, fb)
  }

  const FORMES: [RegExp, string | null][] = [
    [/Soci[eé]t[eé]\s+à\s+responsabilit[eé]\s+limit[eé]e\s+unipersonnelle/i, 'EURL'],
    [/Soci[eé]t[eé]\s+à\s+responsabilit[eé]\s+limit[eé]e/i, 'SARL'],
    [/Soci[eé]t[eé]\s+par\s+actions\s+simplifi[eé]e\s+unipersonnelle/i, 'SASU'],
    [/Soci[eé]t[eé]\s+par\s+actions\s+simplifi[eé]e/i, 'SAS'],
    [/Soci[eé]t[eé]\s+anonyme/i, 'SA'],
    [/Soci[eé]t[eé]\s+civile\s+immobili[eè]re/i, 'SCI'],
    [/Soci[eé]t[eé]\s+civile/i, 'SC'],
    [/Entrepreneur individuel/i, 'EI'],
    [/\b(SASU|SARL|EURL|SAS|SA|SNC|SCI|SELARL|SELAS|EIRL|SCP|GIE|SCOP)\b/, null],
  ]
  for (const [re, label] of FORMES) {
    const m = t.match(re)
    if (m) { result.formeJuridique = label ?? m[1]; break }
  }

  const denomMatch = t.match(/D[eé]nomination\s+ou\s+raison\s+sociale\s+(.+)/i)
    ?? t.match(/(?:D[ée]nomination|Raison sociale)\s*:?\s*([A-Z][^\n]{1,79})/i)
  if (denomMatch) result.name = denomMatch[1].trim()

  const capitalMatch = t.match(/[Cc]apital\s+social\s+([\d\s,.]+\s*(?:[Ee]uros?|€))/i)
    ?? t.match(/[Cc]apital\s+([\d\s,.]+\s*(?:[Ee]uros?|€))/i)
  if (capitalMatch) result.capital = capitalMatch[1].trim()

  const dateMatch = t.match(/Date\s+d.immatriculation\s+(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})/i)
  if (dateMatch) result.dateImmatriculation = dateMatch[1]

  const siegeMatch = t.match(/Adresse\s+du\s+si[eè]ge\s+(.+)/i)
  const adresseLine = siegeMatch?.[1]?.trim()
  if (adresseLine) {
    const cpVille = adresseLine.match(/^(.*?)\s+(\d{5})\s+([A-ZÉÀÂ][^\n]{1,40})\s*$/i)
    if (cpVille) {
      result.adresse = cpVille[1].trim()
      result.codePostal = cpVille[2]
      result.ville = cpVille[3].trim()
    } else {
      result.adresse = adresseLine
      const cp = adresseLine.match(/(\d{5})\s+([A-ZÉÀÂ][^\n]{1,40})/)
      if (cp) { result.codePostal = cp[1]; result.ville = cp[2].trim() }
    }
  }

  return result
}

function parseOrias(t: string): OriasFields {
  const result: OriasFields = {}

  // Nom : les lignes en gras sont répétées deux fois dans pdf-parse, on prend la première occurrence
  // Format : "2 Caps Conseil et Finance\n885 Rue Louis Bréguet\n..."
  // On cherche le bloc entre "L'Orias certifie que l'intermédiaire ci-après" et "Numéro de RCS"
  const blocMatch = t.match(/interm[eé]diaire\s+ci[-\s]apr[eè]s\s+([\s\S]+?)Num[eé]ro\s+de\s+RCS/i)
  if (blocMatch) {
    const lines = blocMatch[1].trim().split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length > 0) result.name = lines[0]
    // Cherche CP + ville dans le bloc
    for (const line of lines) {
      const cp = line.match(/(\d{5})\s+([A-ZÉÀÂ][A-ZÉÀÂa-zéàâ\s\-]+)/)
      if (cp) { result.codePostal = cp[1]; result.ville = cp[2].trim(); break }
    }
    // Adresse = lignes entre nom et CP/ville
    const addrLines = lines.slice(1).filter((l) => !/\d{5}/.test(l))
    if (addrLines.length) result.adresse = addrLines.join(', ')
  }

  // SIREN depuis "Numéro de RCS ... 979761467"
  const rcsMatch = t.match(/Num[eé]ro\s+de\s+RCS[^:]*:\s*[^\d]*(\d{3}\s?\d{3}\s?\d{3})/i)
  if (rcsMatch) result.siren = rcsMatch[1].replace(/\s/g, '')

  // N° ORIAS
  const oriasMatch = t.match(/num[eé]ro\s+d.immatriculation\s+(\d{8})/i)
  if (oriasMatch) result.oriasNumber = oriasMatch[1]

  // Catégories + date de validité — "COA depuis le 12/01/2024 jusqu'au 28/02/2027"
  const categories: string[] = []
  const catRegex = /\b(COA|CIF|MIA|COBSP|IOBSP)\b/gi
  let m: RegExpExecArray | null
  while ((m = catRegex.exec(t)) !== null) {
    const cat = m[1].toUpperCase()
    if (!categories.includes(cat)) categories.push(cat)
  }
  if (categories.length) result.categories = categories

  const validiteMatch = t.match(/jusqu.au\s+(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})/i)
  if (validiteMatch) result.validiteJusquau = validiteMatch[1]

  return result
}

function parseCncgp(t: string): CncgpFields {
  const result: CncgpFields = {}

  // Nom du cabinet — entre "cabinet" (avec ou sans espace) et "(RCS"
  // Le PDF peut avoir les mots collés : "cabinet2CAPSCONSEILETFINANCE(RCS979761467)"
  const nomMatch = t.match(/cabinet\s*([^(\n]{2,60}?)\s*\(RCS/i)
  if (nomMatch) result.name = nomMatch[1].trim()

  // SIREN depuis "(RCS 979761467)" — avec ou sans espace
  const rcsMatch = t.match(/\(RCS\s*(\d{9})\)/i)
  if (rcsMatch) result.siren = rcsMatch[1]

  // N° ORIAS — "sous le n°24000037" ou "sous len°24000037" (mots collés)
  const oriasMatch = t.match(/ORIAS\s+sous\s+le\s*n[°o]\s*(\d{8})/i)
    ?? t.match(/n[°o]\s*(\d{8})/i)
  if (oriasMatch) result.oriasNumber = oriasMatch[1]

  // Catégories — CIF, COA présents en clair même avec mots collés
  const categories: string[] = []
  const catRegex = /\b(COA|CIF|MIA|COBSP|IOBSP)\b/gi
  let m: RegExpExecArray | null
  while ((m = catRegex.exec(t)) !== null) {
    const cat = m[1].toUpperCase()
    if (!categories.includes(cat)) categories.push(cat)
  }
  if (categories.length) result.categories = categories

  // Date d'adhésion — "depuis le 08/11/2023"
  const dateMatch = t.match(/depuis\s+le\s+(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})/i)
  if (dateMatch) result.dateAdhesion = dateMatch[1]

  return result
}
