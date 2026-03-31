import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { GlobalRole, GdprRequestStatus } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { supabaseAdmin } from '../../lib/supabase'
import { updateReportBody } from '../clusters/schemas'
import { sendGdprRequestConfirmEmail } from '../../lib/mailer'
import { minioNative, BUCKET } from '../../lib/minio'

async function platformAdminMiddleware(request: Parameters<typeof authMiddleware>[0], reply: Parameters<typeof authMiddleware>[1]) {
  if (request.user?.globalRole !== GlobalRole.platform_admin) {
    return reply.status(403).send({ error: 'Réservé aux administrateurs de la plateforme', code: 'FORBIDDEN' })
  }
}

export const adminRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /api/v1/admin/platform-users ─────────────────────────────────────
  app.get('/platform-users', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { role, search } = request.query as { role?: string; search?: string }

    const users = await prisma.user.findMany({
      where: {
        ...(role ? { globalRole: role as GlobalRole } : {}),
        ...(search ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, globalRole: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: { users } })
  })

  // ── POST /api/v1/admin/platform-users/invite ──────────────────────────────
  app.post('/platform-users/invite', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const bodySchema = z.object({
      email: z.string().email('Email invalide'),
      firstName: z.string().min(1, 'Prénom requis'),
      lastName: z.string().min(1, 'Nom requis'),
      globalRole: z.enum([GlobalRole.chamber, GlobalRole.regulator, GlobalRole.platform_admin, GlobalRole.supplier]),
    })

    const result = bodySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { email, firstName, lastName, globalRole } = result.data

    // Vérifie que l'email n'est pas déjà utilisé
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(409).send({ error: 'Un compte avec cet email existe déjà', code: 'ALREADY_EXISTS' })
    }

    // Crée l'utilisateur dans Supabase Auth + envoie l'invitation
    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${process.env.FRONTEND_URL}/accept-invite` },
    })

    if (error || !linkData?.user) {
      return reply.status(500).send({ error: "Échec de la création du compte", code: 'INVITE_ERROR' })
    }

    // Crée l'utilisateur dans notre DB avec le bon rôle
    const user = await prisma.user.create({
      data: {
        id: linkData.user.id,
        email,
        firstName,
        lastName,
        globalRole,
      },
      select: { id: true, email: true, firstName: true, lastName: true, globalRole: true, createdAt: true },
    })

    return reply.status(201).send({ data: { user, inviteUrl: linkData.properties?.action_link ?? null } })
  })

  // ── PATCH /api/v1/admin/platform-users/:id ────────────────────────────────
  app.patch('/platform-users/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const bodySchema = z.object({
      globalRole: z.enum([GlobalRole.chamber, GlobalRole.regulator, GlobalRole.platform_admin, GlobalRole.supplier]).optional(),
      isActive: z.boolean().optional(),
    }).refine((d) => d.globalRole !== undefined || d.isActive !== undefined, {
      message: 'Au moins un champ requis',
    })

    const result = bodySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    if (id === request.user.id && result.data.isActive === false) {
      return reply.status(400).send({ error: 'Vous ne pouvez pas désactiver votre propre compte', code: 'SELF_DISABLE' })
    }

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return reply.status(404).send({ error: 'Utilisateur introuvable', code: 'NOT_FOUND' })
    }

    // Changement de rôle uniquement pour les non-cabinet
    if (result.data.globalRole && user.globalRole === GlobalRole.cabinet_user) {
      return reply.status(400).send({ error: 'Impossible de changer le rôle d\'un cabinet user', code: 'FORBIDDEN' })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(result.data.globalRole ? { globalRole: result.data.globalRole } : {}),
        ...(result.data.isActive !== undefined ? { isActive: result.data.isActive } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, globalRole: true, isActive: true, createdAt: true },
    })

    return reply.send({ data: { user: updated } })
  })

  // ── DELETE /api/v1/admin/platform-users/:id ───────────────────────────────
  app.delete('/platform-users/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    if (id === request.user.id) {
      return reply.status(400).send({ error: 'Vous ne pouvez pas désactiver votre propre compte', code: 'SELF_DELETE' })
    }

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return reply.status(404).send({ error: 'Utilisateur introuvable', code: 'NOT_FOUND' })
    }

    await prisma.user.update({ where: { id }, data: { isActive: false } })
    return reply.status(204).send()
  })

  // ── GET /api/v1/admin/supplier-users/:userId ─────────────────────────────
  // Fiches liées à un utilisateur supplier
  app.get('/supplier-users/:userId', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const links = await prisma.supplierUser.findMany({
      where: { userId },
      include: { supplier: { select: { id: true, name: true, category: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ data: { links } })
  })

  // ── POST /api/v1/admin/supplier-users ─────────────────────────────────────
  // Lie un utilisateur supplier à une fiche
  app.post('/supplier-users', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const bodySchema = z.object({
      userId: z.string().uuid(),
      supplierId: z.string().uuid(),
    })
    const result = bodySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const user = await prisma.user.findUnique({ where: { id: result.data.userId } })
    if (!user || user.globalRole !== 'supplier') {
      return reply.status(400).send({ error: 'L\'utilisateur doit avoir le rôle fournisseur', code: 'INVALID_ROLE' })
    }

    const link = await prisma.supplierUser.upsert({
      where: { supplierId_userId: { supplierId: result.data.supplierId, userId: result.data.userId } },
      create: { supplierId: result.data.supplierId, userId: result.data.userId },
      update: {},
      include: { supplier: { select: { id: true, name: true } } },
    })
    return reply.status(201).send({ data: { link } })
  })

  // ── DELETE /api/v1/admin/supplier-users ───────────────────────────────────
  // Délie un utilisateur supplier d'une fiche
  app.delete('/supplier-users', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const bodySchema = z.object({
      userId: z.string().uuid(),
      supplierId: z.string().uuid(),
    })
    const result = bodySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    await prisma.supplierUser.deleteMany({
      where: { supplierId: result.data.supplierId, userId: result.data.userId },
    })
    return reply.status(204).send()
  })

  // ── GET /api/v1/admin/reports ─────────────────────────────────────────────
  app.get('/reports', { preHandler: [authMiddleware, cabinetMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { status = 'PENDING' } = request.query as { status?: string }

    const reports = await prisma.messageReport.findMany({
      where: { status: status as 'PENDING' | 'REVIEWED' | 'DISMISSED' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
        message: {
          select: {
            id: true,
            content: true,
            deletedAt: true,
            createdAt: true,
            authorUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            authorCabinet: { select: { id: true, name: true } },
            channel: {
              select: {
                id: true,
                name: true,
                cluster: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    return reply.send({ data: { reports } })
  })

  // ── PATCH /api/v1/admin/reports/:id ───────────────────────────────────────
  // REVIEWED → supprime le message signalé · DISMISSED → ignore
  app.patch('/reports/:id', { preHandler: [authMiddleware, cabinetMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const report = await prisma.messageReport.findUnique({
      where: { id },
      select: { id: true, messageId: true, status: true },
    })
    if (!report) {
      return reply.status(404).send({ error: 'Signalement introuvable', code: 'NOT_FOUND' })
    }
    if (report.status !== 'PENDING') {
      return reply.status(409).send({ error: 'Ce signalement a déjà été traité', code: 'ALREADY_RESOLVED' })
    }

    const result = updateReportBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { status } = result.data

    await prisma.$transaction(async (tx) => {
      await tx.messageReport.update({ where: { id }, data: { status } })

      // Si REVIEWED → soft delete du message
      if (status === 'REVIEWED') {
        await tx.message.update({
          where: { id: report.messageId },
          data: { deletedAt: new Date() },
        })
        // Ferme tous les autres signalements en attente sur le même message
        await tx.messageReport.updateMany({
          where: { messageId: report.messageId, status: 'PENDING' },
          data: { status: 'REVIEWED' },
        })
      }
    })

    return reply.send({ data: { status } })
  })

  // ── GET /api/v1/admin/gdpr/requests ──────────────────────────────────────
  // Toutes les demandes RGPD — filtrable par status (défaut: PENDING)
  app.get('/gdpr/requests', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { status } = request.query as { status?: string }

    const where = status
      ? { status: status as GdprRequestStatus }
      : { status: { in: ['PENDING', 'PROCESSING'] as GdprRequestStatus[] } }

    const requests = await prisma.gdprRequest.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        status: true,
        message: true,
        response: true,
        exportPath: true,
        createdAt: true,
        processedAt: true,
        cabinet: { select: { id: true, name: true } },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        processor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    return reply.send({ data: requests })
  })

  // ── PATCH /api/v1/admin/gdpr/requests/:id ─────────────────────────────────
  // Traiter une demande RGPD : DONE ou REJECTED
  app.patch('/gdpr/requests/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const bodySchema = z.object({
      status: z.enum(['PROCESSING', 'DONE', 'REJECTED']),
      response: z.string().max(2000).optional(),
    })
    const result = bodySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'Données invalides', code: 'VALIDATION_ERROR' })
    }

    const gdprRequest = await prisma.gdprRequest.findUnique({
      where: { id },
      include: {
        cabinet: { select: { id: true, name: true } },
        requester: { select: { email: true } },
      },
    })
    if (!gdprRequest) {
      return reply.status(404).send({ error: 'Demande introuvable', code: 'NOT_FOUND' })
    }
    if (gdprRequest.status === 'DONE' || gdprRequest.status === 'REJECTED') {
      return reply.status(409).send({ error: 'Cette demande a déjà été traitée', code: 'ALREADY_RESOLVED' })
    }

    const { status, response } = result.data

    const updated = await prisma.gdprRequest.update({
      where: { id },
      data: {
        status,
        response,
        processedBy: request.user.id,
        processedAt: status === 'DONE' || status === 'REJECTED' ? new Date() : undefined,
      },
    })

    // Si DONE → générer lien de téléchargement si un export_path existe
    let downloadUrl: string | null = null
    if (status === 'DONE' && updated.exportPath) {
      try {
        downloadUrl = await minioNative.presignedGetObject(
          BUCKET,
          updated.exportPath,
          7 * 24 * 60 * 60 // 7 jours
        )
      } catch { /* non bloquant */ }
    }

    // Notification email au cabinet (non bloquant)
    if (status === 'DONE' || status === 'REJECTED') {
      sendGdprRequestConfirmEmail({
        to: gdprRequest.requester.email,
        cabinetName: gdprRequest.cabinet.name,
        type: gdprRequest.type,
        status,
        response,
        downloadUrl,
      }).catch(() => { /* non bloquant */ })
    }

    return reply.send({ data: updated })
  })

  // ── GET /api/v1/admin/product-subcategories ───────────────────────────────
  app.get('/product-subcategories', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const subcategories = await prisma.productSubcategory.findMany({
      orderBy: [{ mainCategory: 'asc' }, { order: 'asc' }],
    })
    return reply.send({ data: { subcategories } })
  })

  // ── POST /api/v1/admin/product-subcategories ──────────────────────────────
  app.post('/product-subcategories', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const body = request.body as { mainCategory: 'assurance' | 'cif'; label: string }
    if (!body?.label?.trim() || !['assurance', 'cif'].includes(body.mainCategory)) {
      return reply.status(400).send({ error: 'Données invalides', code: 'VALIDATION_ERROR' })
    }
    const maxOrder = await prisma.productSubcategory.aggregate({
      where: { mainCategory: body.mainCategory },
      _max: { order: true },
    })
    const sub = await prisma.productSubcategory.create({
      data: {
        mainCategory: body.mainCategory,
        label: body.label.trim(),
        order: (maxOrder._max.order ?? 0) + 1,
      },
    })
    return reply.status(201).send({ data: { subcategory: sub } })
  })

  // ── PATCH /api/v1/admin/product-subcategories/:id ─────────────────────────
  app.patch('/product-subcategories/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { label?: string; order?: number; isActive?: boolean }
    const sub = await prisma.productSubcategory.update({
      where: { id },
      data: {
        ...(body.label ? { label: body.label.trim() } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    })
    return reply.send({ data: { subcategory: sub } })
  })

  // ── DELETE /api/v1/admin/product-subcategories/:id ────────────────────────
  app.delete('/product-subcategories/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.productSubcategory.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── GET /api/v1/admin/governance-axes ────────────────────────────────────
  app.get('/governance-axes', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const axes = await prisma.governanceAxisConfig.findMany({
      orderBy: [{ mainCategory: 'asc' }, { order: 'asc' }],
    })
    return reply.send({ data: { axes } })
  })

  // ── PATCH /api/v1/admin/governance-axes/:id ───────────────────────────────
  app.patch('/governance-axes/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      label?: string
      description?: string
      criteria?: Array<{ field: string; label: string; sublabel?: string }>
      isEnabled?: boolean
      order?: number
    }
    const axis = await prisma.governanceAxisConfig.update({
      where: { id },
      data: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.criteria !== undefined ? { criteria: body.criteria as object } : {}),
        ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
      },
    })
    return reply.send({ data: { axis } })
  })

  // ── GET /api/v1/admin/tool-categories ─────────────────────────────────────
  app.get('/tool-categories', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (_request, reply) => {
    const categories = await prisma.toolCategory.findMany({
      orderBy: { order: 'asc' },
    })
    return reply.send({ data: { categories } })
  })

  // ── POST /api/v1/admin/tool-categories ────────────────────────────────────
  app.post('/tool-categories', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const body = request.body as { label: string }
    if (!body?.label?.trim()) {
      return reply.status(400).send({ error: 'Le label est requis', code: 'VALIDATION_ERROR' })
    }
    const maxOrder = await prisma.toolCategory.aggregate({ _max: { order: true } })
    const category = await prisma.toolCategory.create({
      data: {
        label: body.label.trim(),
        order: (maxOrder._max.order ?? 0) + 1,
      },
    })
    return reply.status(201).send({ data: { category } })
  })

  // ── PATCH /api/v1/admin/tool-categories/:id ───────────────────────────────
  app.patch('/tool-categories/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { label?: string; order?: number; isActive?: boolean }
    const category = await prisma.toolCategory.update({
      where: { id },
      data: {
        ...(body.label ? { label: body.label.trim() } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    })
    return reply.send({ data: { category } })
  })

  // ── DELETE /api/v1/admin/tool-categories/:id ──────────────────────────────
  app.delete('/tool-categories/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.toolCategory.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── GET /api/v1/admin/training-categories ─────────────────────────────────
  app.get('/training-categories', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (_request, reply) => {
    const categories = await prisma.trainingCategory.findMany({ orderBy: { order: 'asc' } })
    return reply.send({ data: { categories } })
  })

  // ── POST /api/v1/admin/training-categories ────────────────────────────────
  app.post('/training-categories', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const body = request.body as { name: string; code: string; requiredHours?: number; requiredHoursPeriod?: number }
    if (!body?.name?.trim() || !body?.code?.trim()) {
      return reply.status(400).send({ error: 'Le nom et le code sont requis', code: 'VALIDATION_ERROR' })
    }
    const maxOrder = await prisma.trainingCategory.aggregate({ _max: { order: true } })
    const category = await prisma.trainingCategory.create({
      data: {
        name: body.name.trim(),
        code: body.code.trim().toLowerCase(),
        order: (maxOrder._max.order ?? 0) + 1,
        ...(body.requiredHours != null ? { requiredHours: body.requiredHours } : {}),
        ...(body.requiredHoursPeriod != null ? { requiredHoursPeriod: body.requiredHoursPeriod } : {}),
      },
    })
    return reply.status(201).send({ data: { category } })
  })

  // ── PATCH /api/v1/admin/training-categories/:id ───────────────────────────
  app.patch('/training-categories/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { name?: string; code?: string; order?: number; isActive?: boolean; requiredHours?: number | null; requiredHoursPeriod?: number | null }
    const category = await prisma.trainingCategory.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.code ? { code: body.code.trim().toLowerCase() } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.requiredHours !== undefined ? { requiredHours: body.requiredHours } : {}),
        ...(body.requiredHoursPeriod !== undefined ? { requiredHoursPeriod: body.requiredHoursPeriod } : {}),
      },
    })
    return reply.send({ data: { category } })
  })

  // ── DELETE /api/v1/admin/training-categories/:id ─────────────────────────
  app.delete('/training-categories/:id', { preHandler: [authMiddleware, platformAdminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    // Empêcher la suppression si des formations du catalogue l'utilisent
    const count = await prisma.trainingCatalog.count({ where: { categoryId: id, deletedAt: null } })
    if (count > 0) {
      return reply.status(409).send({ error: `Cette catégorie est utilisée par ${count} formation(s) du catalogue`, code: 'IN_USE' })
    }
    await prisma.trainingCategory.delete({ where: { id } })
    return reply.status(204).send()
  })
}
