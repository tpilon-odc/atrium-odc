import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { supplierMiddleware } from '../../middleware/supplier'
import { prisma } from '../../lib/prisma'

const updateSupplierBody = z.object({
  name: z.string().min(1, 'Le nom est requis').optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
})

export const supplierPortalRoutes: FastifyPluginAsync = async (app) => {
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
}
