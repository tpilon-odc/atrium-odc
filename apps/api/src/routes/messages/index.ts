import { FastifyPluginAsync } from 'fastify'
import { ClusterRole } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { broadcastToChannel } from '../../lib/supabase'
import {
  listMessagesQuery,
  createMessageBody,
  updateMessageBody,
  reactionBody,
  reportBody,
} from '../clusters/schemas'

// ── Helpers ───────────────────────────────────────────────────────────────────

const messageSelect = {
  id: true,
  channelId: true,
  authorUserId: true,
  authorCabinetId: true,
  content: true,
  parentId: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  authorUser: {
    select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
  },
  authorCabinet: {
    select: { id: true, name: true },
  },
  reactions: {
    select: { emoji: true, userId: true, cabinetId: true },
  },
  _count: { select: { replies: true } },
} as const

// Masque le contenu des messages supprimés
function formatMessage(msg: {
  deletedAt: Date | null
  content: string
  reactions: unknown[]
  [key: string]: unknown
}) {
  if (msg.deletedAt) {
    return { ...msg, content: '[Message supprimé]', reactions: [] }
  }
  return msg
}

// Vérifie l'accès à un channel (membre du cluster)
async function assertChannelAccess(channelId: string, cabinetId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true, clusterId: true, isPrivate: true, type: true, name: true,
      cluster: { select: { name: true } },
    },
  })
  if (!channel) return null

  const member = await prisma.clusterMember.findUnique({
    where: { clusterId_cabinetId: { clusterId: channel.clusterId, cabinetId } },
    select: { role: true },
  })
  if (!member) return null

  return { channel, role: member.role }
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const messageRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /api/v1/channels/:id ───────────────────────────────────────────────
  app.get('/channels/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const access = await assertChannelAccess(id, request.cabinetId)
    if (!access) {
      return reply.status(403).send({ error: 'Accès refusé à ce channel', code: 'FORBIDDEN' })
    }

    return reply.send({ data: { channel: access.channel } })
  })

  // ── GET /api/v1/channels/:id/messages ─────────────────────────────────────
  app.get('/channels/:id/messages', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const access = await assertChannelAccess(id, request.cabinetId)
    if (!access) {
      return reply.status(403).send({ error: 'Accès refusé à ce channel', code: 'FORBIDDEN' })
    }

    const query = listMessagesQuery.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: query.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { parentId, cursor, limit } = query.data

    const messages = await prisma.message.findMany({
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        channelId: id,
        parentId: parentId ?? null,
      },
      select: messageSelect,
      orderBy: { createdAt: 'asc' },
    })

    const hasMore = messages.length > limit
    const items = hasMore ? messages.slice(0, limit) : messages
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return reply.send({ data: { messages: items.map(formatMessage), nextCursor, hasMore } })
  })

  // ── POST /api/v1/channels/:id/messages ────────────────────────────────────
  app.post('/channels/:id/messages', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const access = await assertChannelAccess(id, request.cabinetId)
    if (!access) {
      return reply.status(403).send({ error: 'Accès refusé à ce channel', code: 'FORBIDDEN' })
    }

    const result = createMessageBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { content, parentId } = result.data

    // Vérifie que le parent appartient bien au même channel
    let parentAuthorUserId: string | null = null
    let parentAuthorCabinetId: string | null = null
    if (parentId) {
      const parent = await prisma.message.findFirst({
        where: { id: parentId, channelId: id, deletedAt: null },
        select: { id: true, authorUserId: true, authorCabinetId: true },
      })
      if (!parent) {
        return reply.status(400).send({ error: 'Message parent introuvable', code: 'INVALID_PARENT' })
      }
      parentAuthorUserId = parent.authorUserId
      parentAuthorCabinetId = parent.authorCabinetId
    }

    const message = await prisma.message.create({
      data: {
        channelId: id,
        authorUserId: request.user.id,
        authorCabinetId: request.cabinetId,
        content,
        parentId: parentId ?? null,
      },
      select: messageSelect,
    })

    // Broadcast aux clients Realtime abonnés à ce channel
    broadcastToChannel(id, 'message:new', { messageId: message.id }).catch(() => {})

    // Notification de réponse — non bloquant
    if (parentId && parentAuthorUserId && parentAuthorCabinetId && parentAuthorUserId !== request.user.id) {
      const senderName = [message.authorUser.firstName, message.authorUser.lastName].filter(Boolean).join(' ') || message.authorUser.email
      prisma.notification.create({
        data: {
          cabinetId: parentAuthorCabinetId,
          userId: parentAuthorUserId,
          type: 'cluster_reply',
          title: 'Nouvelle réponse',
          message: `${senderName} a répondu à votre message dans #${access.channel.name} — ${access.channel.cluster.name}`,
          entityType: 'channel',
          entityId: id,
        },
      }).catch(() => {})
    }

    return reply.status(201).send({ data: { message: formatMessage(message) } })
  })

  // ── PATCH /api/v1/messages/:id ────────────────────────────────────────────
  app.patch('/messages/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.message.findFirst({
      where: { id, deletedAt: null },
      select: { authorUserId: true, authorCabinetId: true, channelId: true },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Message introuvable', code: 'NOT_FOUND' })
    }
    if (existing.authorUserId !== request.user.id) {
      return reply.status(403).send({ error: 'Vous ne pouvez modifier que vos propres messages', code: 'FORBIDDEN' })
    }

    const result = updateMessageBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const message = await prisma.message.update({
      where: { id },
      data: { content: result.data.content },
      select: messageSelect,
    })

    return reply.send({ data: { message: formatMessage(message) } })
  })

  // ── DELETE /api/v1/messages/:id ───────────────────────────────────────────
  // Auteur OU ADMIN/OWNER du cluster
  app.delete('/messages/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.message.findFirst({
      where: { id, deletedAt: null },
      select: {
        authorUserId: true,
        authorCabinetId: true,
        channel: { select: { clusterId: true } },
      },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Message introuvable', code: 'NOT_FOUND' })
    }

    const isAuthor = existing.authorUserId === request.user.id
    if (!isAuthor) {
      // Vérifie si ADMIN/OWNER du cluster
      const member = await prisma.clusterMember.findUnique({
        where: {
          clusterId_cabinetId: {
            clusterId: existing.channel.clusterId,
            cabinetId: request.cabinetId,
          },
        },
        select: { role: true },
      })
      const canDelete = member?.role === ClusterRole.OWNER || member?.role === ClusterRole.ADMIN
      if (!canDelete) {
        return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
      }
    }

    const deletedMsg = await prisma.message.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { channelId: true },
    })

    broadcastToChannel(deletedMsg.channelId, 'message:delete', { messageId: id }).catch(() => {})

    return reply.status(204).send()
  })

  // ── POST /api/v1/messages/:id/reactions ───────────────────────────────────
  // Toggle : ajoute si absent, retire si présent
  app.post('/messages/:id/reactions', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const message = await prisma.message.findFirst({
      where: { id, deletedAt: null },
      select: { channelId: true },
    })
    if (!message) {
      return reply.status(404).send({ error: 'Message introuvable', code: 'NOT_FOUND' })
    }

    const access = await assertChannelAccess(message.channelId, request.cabinetId)
    if (!access) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const result = reactionBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { emoji } = result.data

    const existing = await prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId: id, userId: request.user.id, emoji } },
    })

    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } })
      broadcastToChannel(message.channelId, 'reaction:toggle', { messageId: id, emoji, action: 'removed' }).catch(() => {})
      return reply.send({ data: { action: 'removed', emoji } })
    }

    await prisma.messageReaction.create({
      data: { messageId: id, userId: request.user.id, cabinetId: request.cabinetId, emoji },
    })

    broadcastToChannel(message.channelId, 'reaction:toggle', { messageId: id, emoji, action: 'added' }).catch(() => {})
    return reply.status(201).send({ data: { action: 'added', emoji } })
  })

  // ── POST /api/v1/messages/:id/report ─────────────────────────────────────
  app.post('/messages/:id/report', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const message = await prisma.message.findFirst({
      where: { id, deletedAt: null },
      select: { channelId: true },
    })
    if (!message) {
      return reply.status(404).send({ error: 'Message introuvable', code: 'NOT_FOUND' })
    }

    const access = await assertChannelAccess(message.channelId, request.cabinetId)
    if (!access) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const result = reportBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const report = await prisma.messageReport.create({
      data: { messageId: id, reportedBy: request.user.id, reason: result.data.reason },
      select: { id: true, status: true, createdAt: true },
    })

    return reply.status(201).send({ data: { report } })
  })
}
