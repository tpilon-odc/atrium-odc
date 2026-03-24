import { FastifyPluginAsync } from 'fastify'
import { ClusterRole } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import {
  listClustersQuery,
  createClusterBody,
  updateClusterBody,
  inviteCabinetBody,
  createChannelBody,
  updateChannelBody,
} from './schemas'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getMemberRole(clusterId: string, cabinetId: string): Promise<ClusterRole | null> {
  const member = await prisma.clusterMember.findUnique({
    where: { clusterId_cabinetId: { clusterId, cabinetId } },
    select: { role: true },
  })
  return member?.role ?? null
}

function canManage(role: ClusterRole | null): boolean {
  return role === ClusterRole.OWNER || role === ClusterRole.ADMIN
}

const clusterSelect = {
  id: true,
  name: true,
  description: true,
  isPublic: true,
  isVerified: true,
  avatarUrl: true,
  createdAt: true,
  createdBy: true,
  creator: { select: { id: true, firstName: true, lastName: true, email: true } },
  _count: { select: { members: true, channels: true } },
} as const

const channelSelect = {
  id: true,
  clusterId: true,
  name: true,
  type: true,
  isPrivate: true,
  createdAt: true,
  lastMessageAt: true,
} as const

// ── Routes ────────────────────────────────────────────────────────────────────

export const clusterRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /api/v1/clusters ──────────────────────────────────────────────────
  // Clusters publics + ceux où le cabinet est membre
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const query = listClustersQuery.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: query.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { search, cursor, limit } = query.data

    const clusters = await prisma.cluster.findMany({
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        OR: [
          { isPublic: true },
          { members: { some: { cabinetId: request.cabinetId } } },
        ],
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: clusterSelect,
    })

    const hasMore = clusters.length > limit
    const items = hasMore ? clusters.slice(0, limit) : clusters
    const nextCursor = hasMore ? items[items.length - 1].id : null

    // Enrichit avec is_member par cluster
    const memberClusterIds = new Set(
      (await prisma.clusterMember.findMany({
        where: { cabinetId: request.cabinetId, clusterId: { in: items.map((c) => c.id) } },
        select: { clusterId: true, role: true },
      })).map((m) => m.clusterId)
    )

    const data = items.map((c) => ({ ...c, isMember: memberClusterIds.has(c.id) }))

    return reply.send({ data: { clusters: data, nextCursor, hasMore } })
  })

  // ── GET /api/v1/clusters/:id ──────────────────────────────────────────────
  app.get('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const cluster = await prisma.cluster.findUnique({
      where: { id },
      select: { ...clusterSelect, channels: { select: channelSelect, orderBy: { createdAt: 'asc' } } },
    })

    if (!cluster) {
      return reply.status(404).send({ error: 'Cluster introuvable', code: 'NOT_FOUND' })
    }

    const role = await getMemberRole(id, request.cabinetId)
    const isMember = role !== null

    if (!cluster.isPublic && !isMember) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    // Filtre les channels privés si pas membre
    const channels = isMember
      ? cluster.channels
      : cluster.channels.filter((ch) => !ch.isPrivate)

    return reply.send({ data: { cluster: { ...cluster, channels, isMember, role } } })
  })

  // ── POST /api/v1/clusters ─────────────────────────────────────────────────
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const result = createClusterBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { name, description, isPublic, avatarUrl } = result.data

    const cluster = await prisma.$transaction(async (tx) => {
      const c = await tx.cluster.create({
        data: {
          name,
          description,
          isPublic,
          avatarUrl,
          createdBy: request.user.id,
        },
        select: { id: true, name: true },
      })

      // Le cabinet créateur devient OWNER
      await tx.clusterMember.create({
        data: { clusterId: c.id, cabinetId: request.cabinetId, role: ClusterRole.OWNER },
      })

      // Channel #général par défaut
      await tx.channel.create({
        data: { clusterId: c.id, name: 'général', type: 'ASYNC', createdBy: request.user.id },
      })

      return c
    })

    return reply.status(201).send({ data: { cluster } })
  })

  // ── PATCH /api/v1/clusters/:id ────────────────────────────────────────────
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.cabinetId)

    if (!canManage(role)) {
      return reply.status(403).send({ error: 'Réservé aux admins du cluster', code: 'FORBIDDEN' })
    }

    const result = updateClusterBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const cluster = await prisma.cluster.update({
      where: { id },
      data: result.data,
      select: clusterSelect,
    })

    return reply.send({ data: { cluster } })
  })

  // ── DELETE /api/v1/clusters/:id ───────────────────────────────────────────
  // Soft delete — uniquement le OWNER
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.cabinetId)

    if (role !== ClusterRole.OWNER) {
      return reply.status(403).send({ error: 'Réservé au propriétaire du cluster', code: 'FORBIDDEN' })
    }

    // Soft delete via deletedAt — on marque le cluster comme privé et on supprime les membres
    // (pas de deletedAt sur Cluster dans le schéma — on retire tous les membres ce qui le rend inaccessible)
    await prisma.$transaction([
      prisma.clusterMember.deleteMany({ where: { clusterId: id } }),
      prisma.cluster.update({ where: { id }, data: { isPublic: false } }),
    ])

    return reply.status(204).send()
  })

  // ── POST /api/v1/clusters/:id/join ────────────────────────────────────────
  app.post('/:id/join', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const cluster = await prisma.cluster.findUnique({ where: { id }, select: { isPublic: true } })
    if (!cluster) {
      return reply.status(404).send({ error: 'Cluster introuvable', code: 'NOT_FOUND' })
    }
    if (!cluster.isPublic) {
      return reply.status(403).send({ error: 'Ce cluster est privé — invitation requise', code: 'PRIVATE_CLUSTER' })
    }

    const existing = await getMemberRole(id, request.cabinetId)
    if (existing) {
      return reply.status(409).send({ error: 'Déjà membre de ce cluster', code: 'ALREADY_MEMBER' })
    }

    await prisma.clusterMember.create({
      data: { clusterId: id, cabinetId: request.cabinetId, role: ClusterRole.MEMBER },
    })

    return reply.status(201).send({ data: { role: ClusterRole.MEMBER } })
  })

  // ── POST /api/v1/clusters/:id/leave ──────────────────────────────────────
  app.post('/:id/leave', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.cabinetId)

    if (!role) {
      return reply.status(404).send({ error: 'Vous n\'êtes pas membre de ce cluster', code: 'NOT_MEMBER' })
    }
    if (role === ClusterRole.OWNER) {
      return reply.status(400).send({ error: 'Le propriétaire ne peut pas quitter le cluster', code: 'OWNER_CANNOT_LEAVE' })
    }

    await prisma.clusterMember.delete({
      where: { clusterId_cabinetId: { clusterId: id, cabinetId: request.cabinetId } },
    })

    return reply.status(204).send()
  })

  // ── POST /api/v1/clusters/:id/invite ─────────────────────────────────────
  app.post('/:id/invite', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.cabinetId)

    if (!canManage(role)) {
      return reply.status(403).send({ error: 'Réservé aux admins du cluster', code: 'FORBIDDEN' })
    }

    const result = inviteCabinetBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { cabinetId } = result.data

    const cabinetExists = await prisma.cabinet.findUnique({ where: { id: cabinetId }, select: { id: true } })
    if (!cabinetExists) {
      return reply.status(404).send({ error: 'Cabinet introuvable', code: 'NOT_FOUND' })
    }

    const existing = await prisma.clusterMember.findUnique({
      where: { clusterId_cabinetId: { clusterId: id, cabinetId } },
    })
    if (existing) {
      return reply.status(409).send({ error: 'Ce cabinet est déjà membre', code: 'ALREADY_MEMBER' })
    }

    const member = await prisma.clusterMember.create({
      data: { clusterId: id, cabinetId, role: ClusterRole.MEMBER, invitedBy: request.user.id },
      select: { id: true, cabinetId: true, role: true, joinedAt: true },
    })

    return reply.status(201).send({ data: { member } })
  })

  // ── GET /api/v1/clusters/:id/channels ────────────────────────────────────
  app.get('/:id/channels', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.cabinetId)

    const cluster = await prisma.cluster.findUnique({ where: { id }, select: { isPublic: true } })
    if (!cluster) {
      return reply.status(404).send({ error: 'Cluster introuvable', code: 'NOT_FOUND' })
    }
    if (!cluster.isPublic && !role) {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' })
    }

    const channels = await prisma.channel.findMany({
      where: {
        clusterId: id,
        ...(role ? {} : { isPrivate: false }),
      },
      select: channelSelect,
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({ data: { channels } })
  })

  // ── POST /api/v1/clusters/:id/channels ───────────────────────────────────
  app.post('/:id/channels', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.cabinetId)

    if (!canManage(role)) {
      return reply.status(403).send({ error: 'Réservé aux admins du cluster', code: 'FORBIDDEN' })
    }

    const result = createChannelBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const channel = await prisma.channel.create({
      data: { ...result.data, clusterId: id, createdBy: request.user.id },
      select: channelSelect,
    })

    return reply.status(201).send({ data: { channel } })
  })

  // ── PATCH /api/v1/clusters/:clusterId/channels/:channelId ─────────────────
  app.patch('/:clusterId/channels/:channelId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { clusterId, channelId } = request.params as { clusterId: string; channelId: string }
    const role = await getMemberRole(clusterId, request.cabinetId)

    if (!canManage(role)) {
      return reply.status(403).send({ error: 'Réservé aux admins du cluster', code: 'FORBIDDEN' })
    }

    const channel = await prisma.channel.findFirst({
      where: { id: channelId, clusterId },
      select: { id: true },
    })
    if (!channel) {
      return reply.status(404).send({ error: 'Channel introuvable', code: 'NOT_FOUND' })
    }

    const result = updateChannelBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: result.data,
      select: channelSelect,
    })

    return reply.send({ data: { channel: updated } })
  })

  // ── DELETE /api/v1/clusters/:clusterId/channels/:channelId ────────────────
  app.delete('/:clusterId/channels/:channelId', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { clusterId, channelId } = request.params as { clusterId: string; channelId: string }
    const role = await getMemberRole(clusterId, request.cabinetId)

    if (!canManage(role)) {
      return reply.status(403).send({ error: 'Réservé aux admins du cluster', code: 'FORBIDDEN' })
    }

    const channel = await prisma.channel.findFirst({
      where: { id: channelId, clusterId },
      select: { id: true },
    })
    if (!channel) {
      return reply.status(404).send({ error: 'Channel introuvable', code: 'NOT_FOUND' })
    }

    // Soft delete des messages + suppression du channel
    await prisma.$transaction([
      prisma.message.updateMany({ where: { channelId }, data: { deletedAt: new Date() } }),
      prisma.channel.delete({ where: { id: channelId } }),
    ])

    return reply.status(204).send()
  })
}
