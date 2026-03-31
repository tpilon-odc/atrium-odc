import { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { MemberRole } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { supabaseAdmin } from '../../lib/supabase'
import { uploadToMinio, deleteFromMinio, getPresignedUrl, BUCKET } from '../../lib/minio'
import {
  createCabinetBody,
  updateCabinetBody,
  inviteMemberBody,
  updateMemberBody,
  addExternalMemberBody,
} from './schemas'

// Helper : récupère le membre courant avec son rôle
async function getCurrentMember(userId: string, cabinetId: string) {
  return prisma.cabinetMember.findFirst({
    where: { userId, cabinetId, deletedAt: null },
  })
}

export const cabinetRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } })

  // ── POST /api/v1/cabinets ─────────────────────────────────────────────────
  // Création du cabinet + ajout de l'utilisateur comme owner
  // Pas de cabinetMiddleware : l'utilisateur n'a pas encore de cabinet
  app.post('/', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = createCabinetBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        error: result.error.errors[0].message,
        code: 'VALIDATION_ERROR',
      })
    }

    const { name, siret, oriasNumber } = result.data

    const SYSTEM_FOLDERS = [
      { name: 'Général',           order: 0 },
      { name: 'Contrats',          order: 1 },
      { name: 'Pièces d\'identité', order: 2 },
      { name: 'Conformité',        order: 3 },
    ]

    const data = await prisma.$transaction(async (tx) => {
      const cabinet = await tx.cabinet.create({
        data: { name, siret, oriasNumber },
      })
      const member = await tx.cabinetMember.create({
        data: {
          cabinetId: cabinet.id,
          userId: request.user.id,
          role: MemberRole.owner,
          canManageSuppliers: true,
          canManageProducts: true,
          canManageContacts: true,
        },
      })
      await tx.folder.createMany({
        data: SYSTEM_FOLDERS.map((f) => ({
          cabinetId: cabinet.id,
          name: f.name,
          order: f.order,
          isSystem: true,
        })),
      })
      return { cabinet, member }
    })

    return reply.status(201).send({ data })
  })

  // ── GET /api/v1/cabinets ─────────────────────────────────────────────────
  // Annuaire public des cabinets inscrits (tous utilisateurs connectés)
  app.get('/', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = request.query as { search?: string; city?: string; cursor?: string; limit?: string }
    const limit = Math.min(parseInt(query.limit ?? '20', 10), 50)
    const search = query.search?.trim() || undefined
    const city = query.city?.trim() || undefined
    const cursor = query.cursor || undefined

    const cabinets = await prisma.cabinet.findMany({
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        deletionRequestedAt: null,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
        ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        city: true,
        website: true,
        oriasNumber: true,
        logoUrl: true,
        createdAt: true,
        _count: { select: { members: { where: { deletedAt: null, isPublic: true } } } },
      },
    })

    const hasMore = cabinets.length > limit
    const items = hasMore ? cabinets.slice(0, limit) : cabinets
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return reply.send({ data: { cabinets: items, nextCursor, hasMore } })
  })

  // ── GET /api/v1/cabinets/:id ─────────────────────────────────────────────
  // Fiche publique d'un cabinet (tout utilisateur connecté)
  app.get('/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const cabinet = await prisma.cabinet.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        siret: true,
        oriasNumber: true,
        description: true,
        city: true,
        website: true,
        logoUrl: true,
        createdAt: true,
        members: {
          where: { deletedAt: null, isPublic: true },
          select: {
            id: true,
            role: true,
            externalFirstName: true,
            externalLastName: true,
            externalEmail: true,
            externalTitle: true,
            user: {
              select: {
                id: true,
                civility: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { cabinet: { createdAt: 'asc' } },
        },
      },
    })

    if (!cabinet) {
      return reply.status(404).send({ error: 'Cabinet introuvable', code: 'NOT_FOUND' })
    }

    return reply.send({ data: { cabinet } })
  })

  // ── GET /api/v1/cabinets/me ───────────────────────────────────────────────
  app.get(
    '/me',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const cabinet = await prisma.cabinet.findUnique({
        where: { id: request.cabinetId },
      })
      if (!cabinet) {
        return reply.status(404).send({ error: 'Cabinet introuvable', code: 'NOT_FOUND' })
      }
      return reply.send({ data: { cabinet } })
    }
  )

  // ── PATCH /api/v1/cabinets/me ─────────────────────────────────────────────
  app.patch(
    '/me',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const currentMember = await getCurrentMember(request.user.id, request.cabinetId)
      if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
        return reply.status(403).send({ error: 'Droits insuffisants', code: 'FORBIDDEN' })
      }

      const result = updateCabinetBody.safeParse(request.body)
      if (result.success) {
        const profileFields = ['description', 'city', 'website'] as const
        const hasProfileField = profileFields.some((f) => f in result.data)
        if (hasProfileField && currentMember.role !== MemberRole.owner) {
          return reply.status(403).send({
            error: 'Seul le propriétaire peut modifier le profil public du cabinet',
            code: 'FORBIDDEN',
          })
        }
      }
      if (!result.success) {
        return reply.status(400).send({
          error: result.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        })
      }

      const cabinet = await prisma.cabinet.update({
        where: { id: request.cabinetId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: result.data as any,
      })

      return reply.send({ data: { cabinet } })
    }
  )

  // ── POST /api/v1/cabinets/me/logo ─────────────────────────────────────────
  app.post(
    '/me/logo',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const currentMember = await getCurrentMember(request.user.id, request.cabinetId)
      if (!currentMember || currentMember.role !== MemberRole.owner) {
        return reply.status(403).send({ error: 'Seul le propriétaire peut modifier le logo', code: 'FORBIDDEN' })
      }

      const file = await request.file()
      if (!file) return reply.status(400).send({ error: 'Aucun fichier reçu', code: 'NO_FILE' })

      const LOGO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
      const LOGO_MAX_SIZE = 2 * 1024 * 1024
      if (!LOGO_MIME_TYPES.has(file.mimetype)) {
        return reply.status(400).send({ error: 'Format non supporté (JPG, PNG, WebP, SVG)', code: 'INVALID_TYPE' })
      }

      const chunks: Buffer[] = []
      for await (const chunk of file.file) chunks.push(chunk)
      const buffer = Buffer.concat(chunks)
      if (buffer.length > LOGO_MAX_SIZE) {
        return reply.status(400).send({ error: 'Fichier trop volumineux (max 2 Mo)', code: 'FILE_TOO_LARGE' })
      }

      const ext = file.mimetype === 'image/svg+xml' ? 'svg' : file.mimetype.split('/')[1].replace('jpeg', 'jpg')
      const key = `logos/${request.cabinetId}.${ext}`

      const existing = await prisma.cabinet.findUnique({ where: { id: request.cabinetId }, select: { logoUrl: true } })
      if (existing?.logoUrl) {
        const oldKey = existing.logoUrl.split(`/${BUCKET}/`)[1]
        if (oldKey && oldKey !== key) await deleteFromMinio(oldKey).catch(() => {})
      }

      await uploadToMinio(key, buffer, file.mimetype)
      const logoUrl = getPresignedUrl(key)

      const cabinet = await prisma.cabinet.update({
        where: { id: request.cabinetId },
        data: { logoUrl },
        select: { id: true, name: true, logoUrl: true },
      })

      return reply.send({ data: { cabinet } })
    }
  )

  // ── DELETE /api/v1/cabinets/me/logo ───────────────────────────────────────
  app.delete(
    '/me/logo',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const currentMember = await getCurrentMember(request.user.id, request.cabinetId)
      if (!currentMember || currentMember.role !== MemberRole.owner) {
        return reply.status(403).send({ error: 'Seul le propriétaire peut supprimer le logo', code: 'FORBIDDEN' })
      }

      const existing = await prisma.cabinet.findUnique({ where: { id: request.cabinetId }, select: { logoUrl: true } })
      if (existing?.logoUrl) {
        const key = existing.logoUrl.split(`/${BUCKET}/`)[1]
        if (key) await deleteFromMinio(key).catch(() => {})
      }

      await prisma.cabinet.update({ where: { id: request.cabinetId }, data: { logoUrl: null } })
      return reply.status(204).send()
    }
  )

  // ── GET /api/v1/cabinets/me/members ──────────────────────────────────────
  app.get(
    '/me/members',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const members = await prisma.cabinetMember.findMany({
        where: { cabinetId: request.cabinetId, deletedAt: null },
        select: {
          id: true, cabinetId: true, userId: true, role: true,
          canManageSuppliers: true, canManageProducts: true, canManageContacts: true,
          isPublic: true, deletedAt: true,
          externalFirstName: true, externalLastName: true, externalEmail: true, externalTitle: true,
          user: { select: { id: true, email: true, civility: true, firstName: true, lastName: true, globalRole: true } },
        },
        orderBy: { id: 'asc' },
      })
      return reply.send({ data: { members } })
    }
  )

  // ── POST /api/v1/cabinets/me/members/invite ───────────────────────────────
  app.post(
    '/me/members/invite',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const currentMember = await getCurrentMember(request.user.id, request.cabinetId)
      if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
        return reply.status(403).send({ error: 'Droits insuffisants', code: 'FORBIDDEN' })
      }

      const result = inviteMemberBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({
          error: result.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        })
      }

      const { email, role, canManageSuppliers, canManageProducts, canManageContacts } =
        result.data

      // Cherche si l'utilisateur existe déjà dans notre DB
      let targetUserId: string
      let inviteUrl: string | null = null
      const existingUser = await prisma.user.findUnique({ where: { email } })

      if (existingUser) {
        targetUserId = existingUser.id
      } else {
        // generateLink crée l'utilisateur dans Supabase Auth s'il n'existe pas,
        // ou régénère un lien pour un utilisateur déjà invité non confirmé.
        const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email,
          options: { redirectTo: `${process.env.FRONTEND_URL}/accept-invite` },
        })
        if (error || !linkData?.user) {
          console.error('[invite] generateLink error:', error)
          // L'utilisateur existe peut-être déjà dans Supabase Auth (tentative précédente)
          // → on récupère son ID via l'API admin
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
          const authUser = listData?.users?.find((u) => u.email === email)
          if (!authUser) {
            return reply.status(500).send({ error: "Échec de l'invitation", code: 'INVITE_ERROR' })
          }
          targetUserId = authUser.id
          await prisma.user.upsert({
            where: { id: targetUserId },
            create: { id: targetUserId, email },
            update: {},
          })
          // Génère un magic link pour notifier l'utilisateur existant
          const { data: magicData } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: { redirectTo: `${process.env.FRONTEND_URL}/accept-invite` },
          })
          inviteUrl = magicData?.properties?.action_link ?? null
        } else {
          targetUserId = linkData.user.id
          inviteUrl = linkData.properties?.action_link ?? null
          await prisma.user.upsert({
            where: { id: targetUserId },
            create: { id: targetUserId, email },
            update: {},
          })
        }

      }

      // Vérifie qu'il n'est pas déjà membre (avec compte)
      const alreadyMember = await prisma.cabinetMember.findFirst({
        where: { cabinetId: request.cabinetId, userId: targetUserId, deletedAt: null },
      })
      if (alreadyMember) {
        return reply.status(409).send({
          error: 'Cet utilisateur est déjà membre du cabinet',
          code: 'ALREADY_MEMBER',
        })
      }

      let member
      try {
        member = await prisma.cabinetMember.create({
          data: {
            cabinetId: request.cabinetId,
            userId: targetUserId,
            role: role as MemberRole,
            canManageSuppliers,
            canManageProducts,
            canManageContacts,
          },
          include: { user: { select: { id: true, email: true } } },
        })
      } catch (err: unknown) {
        const code = (err as { code?: string }).code
        if (code === 'P2002') {
          return reply.status(409).send({
            error: 'Cet utilisateur est déjà membre du cabinet',
            code: 'ALREADY_MEMBER',
          })
        }
        throw err
      }

      return reply.status(201).send({ data: { member, inviteUrl } })
    }
  )

  // ── PATCH /api/v1/cabinets/me/members/:memberId ───────────────────────────
  app.patch(
    '/me/members/:memberId',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const currentMember = await getCurrentMember(request.user.id, request.cabinetId)
      if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
        return reply.status(403).send({ error: 'Droits insuffisants', code: 'FORBIDDEN' })
      }

      const { memberId } = request.params as { memberId: string }

      const result = updateMemberBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({
          error: result.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        })
      }

      // Seul l'owner peut changer le rôle
      if (result.data.role && currentMember.role !== MemberRole.owner) {
        return reply.status(403).send({
          error: 'Seul le propriétaire peut modifier les rôles',
          code: 'FORBIDDEN',
        })
      }

      const target = await prisma.cabinetMember.findFirst({
        where: { id: memberId, cabinetId: request.cabinetId, deletedAt: null },
      })
      if (!target) {
        return reply.status(404).send({ error: 'Membre introuvable', code: 'NOT_FOUND' })
      }

      const updated = await prisma.cabinetMember.update({
        where: { id: memberId },
        data: result.data,
        include: { user: { select: { id: true, email: true } } },
      })

      return reply.send({ data: { member: updated } })
    }
  )

  // ── DELETE /api/v1/cabinets/me/members/:memberId ──────────────────────────
  app.delete(
    '/me/members/:memberId',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const currentMember = await getCurrentMember(request.user.id, request.cabinetId)
      if (!currentMember || currentMember.role !== MemberRole.owner) {
        return reply.status(403).send({
          error: 'Seul le propriétaire peut retirer des membres',
          code: 'FORBIDDEN',
        })
      }

      const { memberId } = request.params as { memberId: string }

      const target = await prisma.cabinetMember.findFirst({
        where: { id: memberId, cabinetId: request.cabinetId, deletedAt: null },
      })
      if (!target) {
        return reply.status(404).send({ error: 'Membre introuvable', code: 'NOT_FOUND' })
      }
      if (target.userId === request.user.id) {
        return reply.status(400).send({
          error: 'Impossible de vous retirer vous-même',
          code: 'CANNOT_REMOVE_SELF',
        })
      }

      // Soft delete
      await prisma.cabinetMember.update({
        where: { id: memberId },
        data: { deletedAt: new Date() },
      })

      return reply.status(204).send()
    }
  )

  // ── POST /api/v1/cabinets/me/members/external ─────────────────────────────
  // Ajouter un collaborateur sans compte plateforme (affiché sur la fiche publique)
  app.post(
    '/me/members/external',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const currentMember = await getCurrentMember(request.user.id, request.cabinetId)
      if (!currentMember || currentMember.role !== MemberRole.owner) {
        return reply.status(403).send({ error: 'Seul le propriétaire peut ajouter des membres', code: 'FORBIDDEN' })
      }

      const result = addExternalMemberBody.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
      }

      const { firstName, lastName, email, title, isPublic } = result.data

      const member = await prisma.cabinetMember.create({
        data: {
          cabinetId: request.cabinetId,
          userId: null,
          role: MemberRole.member,
          externalFirstName: firstName,
          externalLastName: lastName,
          externalEmail: email || null,
          externalTitle: title || null,
          isPublic,
        },
      })

      return reply.status(201).send({ data: { member } })
    }
  )
}
