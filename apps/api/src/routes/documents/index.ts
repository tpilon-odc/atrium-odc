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
} from './schemas'

export const documentRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } })

  // ── POST /api/v1/documents/upload ─────────────────────────────────────────
  app.post(
    '/upload',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const file = await request.file()
      if (!file) {
        return reply.status(400).send({ error: 'Aucun fichier reçu', code: 'NO_FILE' })
      }

      // Validation MIME côté serveur (specs section 10 - points critiques)
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

      const storagePath = buildStoragePath(request.cabinetId, file.filename)

      await uploadToMinio(storagePath, buffer, file.mimetype)

      const document = await prisma.document.create({
        data: {
          cabinetId: request.cabinetId,
          uploadedBy: request.user.id,
          name: file.filename,
          storageMode: StorageMode.hosted,
          storagePath,
          mimeType: file.mimetype,
          sizeBytes: BigInt(buffer.length),
        },
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

    const { cursor, limit, entityType, entityId } = query.data

    const documents = await prisma.document.findMany({
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        cabinetId: request.cabinetId,
        deletedAt: null,
        ...(entityType && entityId
          ? { links: { some: { entityType: entityType as any, entityId } } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { links: true },
    })

    const hasMore = documents.length > limit
    const items = hasMore ? documents.slice(0, limit) : documents
    const nextCursor = hasMore ? items[items.length - 1].id : null

    // BigInt → string pour la sérialisation JSON
    const data = items.map((d) => ({ ...d, sizeBytes: d.sizeBytes?.toString() ?? null }))

    return reply.send({ data: { documents: data, nextCursor, hasMore } })
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
}
