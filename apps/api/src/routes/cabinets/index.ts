import { FastifyPluginAsync } from 'fastify'
import { MemberRole } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { supabaseAdmin } from '../../lib/supabase'
import {
  createCabinetBody,
  updateCabinetBody,
  inviteMemberBody,
  updateMemberBody,
} from './schemas'

// Helper : récupère le membre courant avec son rôle
async function getCurrentMember(userId: string, cabinetId: string) {
  return prisma.cabinetMember.findFirst({
    where: { userId, cabinetId, deletedAt: null },
  })
}

export const cabinetRoutes: FastifyPluginAsync = async (app) => {
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

  // ── GET /api/v1/cabinets/me/members ──────────────────────────────────────
  app.get(
    '/me/members',
    { preHandler: [authMiddleware, cabinetMiddleware] },
    async (request, reply) => {
      const members = await prisma.cabinetMember.findMany({
        where: { cabinetId: request.cabinetId, deletedAt: null },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true, globalRole: true } } },
        orderBy: { cabinet: { createdAt: 'asc' } },
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

      // Vérifie qu'il n'est pas déjà membre
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
}
