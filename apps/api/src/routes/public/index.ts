import { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma'

/**
 * Routes publiques — aucune authentification requise.
 * Exposent uniquement les données que les cabinets ont explicitement rendues publiques.
 */
export const publicRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/v1/public/cabinets ──────────────────────────────────────────
  // Annuaire public des cabinets (membres publics uniquement)
  app.get('/cabinets', async (request, reply) => {
    const query = request.query as {
      search?: string
      city?: string
      cursor?: string
      limit?: string
    }
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
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
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
        _count: {
          select: { members: { where: { deletedAt: null, isPublic: true } } },
        },
      },
    })

    const hasMore = cabinets.length > limit
    const items = hasMore ? cabinets.slice(0, limit) : cabinets
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return reply.send({ data: { cabinets: items, nextCursor, hasMore } })
  })

  // ── GET /api/v1/public/cabinets/:id ──────────────────────────────────────
  // Fiche publique d'un cabinet (membres publics uniquement)
  app.get('/cabinets/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const cabinet = await prisma.cabinet.findUnique({
      where: { id, deletionRequestedAt: null },
      select: {
        id: true,
        name: true,
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
            externalTitle: true,
            // On n'expose pas externalEmail ni siret sur la route publique
            user: {
              select: {
                civility: true,
                firstName: true,
                lastName: true,
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
}
