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
        data: result.data,
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

      // Cherche si l'utilisateur existe déjà
      let targetUserId: string
      const existingUser = await prisma.user.findUnique({ where: { email } })

      if (existingUser) {
        targetUserId = existingUser.id
      } else {
        // Invite via Supabase Auth (envoie un email — visible dans Mailpit :54324)
        const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          email,
          { redirectTo: `${process.env.FRONTEND_URL}/accept-invite` }
        )
        if (error || !invited.user) {
          return reply.status(500).send({ error: "Échec de l'invitation", code: 'INVITE_ERROR' })
        }
        targetUserId = invited.user.id
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

      const member = await prisma.cabinetMember.create({
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

      return reply.status(201).send({ data: { member } })
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
