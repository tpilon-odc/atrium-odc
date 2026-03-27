import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import multipart from '@fastify/multipart'
import { StorageMode } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { supplierMiddleware } from '../../middleware/supplier'
import { prisma } from '../../lib/prisma'
import {
  uploadToMinio,
  deleteFromMinio,
  getPresignedUrl,
  buildStoragePath,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '../../lib/minio'

const updateSupplierBody = z.object({
  name: z.string().min(1, 'Le nom est requis').optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
})

export const supplierPortalRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } })

  // ── GET /api/v1/supplier-portal/me ────────────────────────────────────────
  // Retourne les fiches que cet utilisateur supplier peut gérer
  app.get('/me', { preHandler: [authMiddleware, supplierMiddleware] }, async (request, reply) => {
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: request.supplierIds }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: { suppliers } })
  })

  // ── GET /api/v1/supplier-portal/:id ──────────────────────────────────────
  // Détail d'une fiche (seules les siennes)
  app.get('/:id', { preHandler: [authMiddleware, supplierMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    if (!request.supplierIds.includes(id)) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id, deletedAt: null },
    })
    if (!supplier) {
      return reply.status(404).send({ error: 'Fournisseur introuvable', code: 'NOT_FOUND' })
    }

    return reply.send({ data: { supplier } })
  })

  // ── POST /api/v1/supplier-portal ─────────────────────────────────────────
  // Un fournisseur crée sa propre fiche et devient automatiquement gestionnaire
  app.post('/', { preHandler: [authMiddleware, supplierMiddleware] }, async (request, reply) => {
    const createBody = z.object({
      name: z.string().min(1, 'Le nom est requis'),
      description: z.string().optional(),
      category: z.string().optional(),
      website: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
    })

    const result = createBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const s = await tx.supplier.create({
        data: { ...result.data, createdBy: request.user.id },
      })
      await tx.supplierUser.create({
        data: { supplierId: s.id, userId: request.user.id },
      })
      return s
    })

    return reply.status(201).send({ data: { supplier } })
  })

  // ── PATCH /api/v1/supplier-portal/:id ────────────────────────────────────
  // Mise à jour d'une fiche (seules les siennes)
  app.patch('/:id', { preHandler: [authMiddleware, supplierMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    if (!request.supplierIds.includes(id)) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const result = updateSupplierBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.supplier.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      return reply.status(404).send({ error: 'Fournisseur introuvable', code: 'NOT_FOUND' })
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: result.data,
    })

    return reply.send({ data: { supplier } })
  })

  // ── GET /api/v1/supplier-portal/:id/users ────────────────────────────────
  // Liste les gestionnaires d'une fiche
  app.get('/:id/users', { preHandler: [authMiddleware, supplierMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    if (!request.supplierIds.includes(id)) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const users = await prisma.supplierUser.findMany({
      where: { supplierId: id },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({ data: { users } })
  })

  // ── POST /api/v1/supplier-portal/:id/documents/upload ─────────────────────
  app.post('/:id/documents/upload', { preHandler: [authMiddleware, supplierMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    if (!request.supplierIds.includes(id)) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const file = await request.file()
    if (!file) return reply.status(400).send({ error: 'Aucun fichier reçu', code: 'NO_FILE' })

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return reply.status(400).send({ error: `Type de fichier non autorisé : ${file.mimetype}`, code: 'INVALID_MIME_TYPE' })
    }

    const buffer = await file.toBuffer()
    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({ error: 'Fichier trop volumineux (max 10 Mo)', code: 'FILE_TOO_LARGE' })
    }

    const storagePath = buildStoragePath(`supplier-${id}`, file.filename)
    await uploadToMinio(storagePath, buffer, file.mimetype)

    const document = await prisma.document.create({
      data: {
        supplierId: id,
        uploadedBy: request.user.id,
        name: file.filename,
        storageMode: StorageMode.hosted,
        storagePath,
        mimeType: file.mimetype,
        sizeBytes: BigInt(buffer.length),
      },
    })

    return reply.status(201).send({ data: { document: { ...document, sizeBytes: document.sizeBytes?.toString() } } })
  })

  // ── GET /api/v1/supplier-portal/:id/documents ─────────────────────────────
  app.get('/:id/documents', { preHandler: [authMiddleware, supplierMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    if (!request.supplierIds.includes(id)) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const documents = await prisma.document.findMany({
      where: { supplierId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    const data = documents.map((d) => ({ ...d, sizeBytes: d.sizeBytes?.toString() ?? null }))
    return reply.send({ data: { documents: data } })
  })

  // ── GET /api/v1/supplier-portal/:id/documents/:docId/url ──────────────────
  app.get('/:id/documents/:docId/url', { preHandler: [authMiddleware, supplierMiddleware] }, async (request, reply) => {
    const { id, docId } = request.params as { id: string; docId: string }

    if (!request.supplierIds.includes(id)) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const document = await prisma.document.findFirst({
      where: { id: docId, supplierId: id, deletedAt: null },
    })
    if (!document) return reply.status(404).send({ error: 'Document introuvable', code: 'NOT_FOUND' })

    if (!document.storagePath) return reply.status(500).send({ error: 'Chemin de stockage manquant', code: 'STORAGE_ERROR' })

    const url = getPresignedUrl(document.storagePath)
    return reply.send({ data: { url, expiresIn: 3600 } })
  })

  // ── DELETE /api/v1/supplier-portal/:id/documents/:docId ───────────────────
  app.delete('/:id/documents/:docId', { preHandler: [authMiddleware, supplierMiddleware] }, async (request, reply) => {
    const { id, docId } = request.params as { id: string; docId: string }

    if (!request.supplierIds.includes(id)) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const document = await prisma.document.findFirst({
      where: { id: docId, supplierId: id, deletedAt: null },
    })
    if (!document) return reply.status(404).send({ error: 'Document introuvable', code: 'NOT_FOUND' })

    if (document.storagePath) {
      await deleteFromMinio(document.storagePath)
    }

    await prisma.document.update({ where: { id: docId }, data: { deletedAt: new Date() } })
    return reply.status(204).send()
  })
}
