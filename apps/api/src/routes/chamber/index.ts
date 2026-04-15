import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'

const createPostBody = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  status: z.enum(['draft', 'published']).default('draft'),
})

const updatePostBody = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  status: z.enum(['draft', 'published']).optional(),
})

// Middleware : vérifie que l'utilisateur est une chambre
async function chamberMiddleware(request: any, reply: any) {
  if (request.user.globalRole !== 'chamber') {
    return reply.status(403).send({ error: 'Accès réservé aux chambres', code: 'FORBIDDEN' })
  }
}

export const chamberRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /api/v1/chamber/posts ───────────────────────────────────────────
  // Chambre crée un post (draft ou publié)
  app.post('/posts', { preHandler: [authMiddleware, chamberMiddleware] }, async (request, reply) => {
    const result = createPostBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const { title, content, status } = result.data
    const now = new Date()

    const post = await prisma.chamberPost.create({
      data: {
        chamberId: request.user.id,
        title,
        content,
        status,
        publishedAt: status === 'published' ? now : null,
      },
    })

    // Si publication immédiate → notifier tous les membres actifs des cabinets
    if (status === 'published') {
      await createNotificationsForPost(post.id, post.chamberId, title)
    }

    return reply.status(201).send({ data: { post } })
  })

  // ── GET /api/v1/chamber/posts ────────────────────────────────────────────
  // Chambre liste ses propres posts
  app.get('/posts', { preHandler: [authMiddleware, chamberMiddleware] }, async (request, reply) => {
    const posts = await prisma.chamberPost.findMany({
      where: { chamberId: request.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { reads: true } },
      },
    })

    return reply.send({ data: { posts } })
  })

  // ── PATCH /api/v1/chamber/posts/:id ─────────────────────────────────────
  // Chambre modifie un post (peut aussi publier un draft ici)
  app.patch('/posts/:id', { preHandler: [authMiddleware, chamberMiddleware] }, async (request: any, reply) => {
    const { id } = request.params
    const result = updatePostBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.chamberPost.findFirst({
      where: { id, chamberId: request.user.id },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Post introuvable', code: 'NOT_FOUND' })
    }

    const { title, content, status } = result.data
    const wasPublished = existing.status === 'published'
    const isNowPublished = status === 'published'
    const justPublished = !wasPublished && isNowPublished

    const post = await prisma.chamberPost.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(status !== undefined && { status }),
        ...(justPublished && { publishedAt: new Date() }),
      },
    })

    // Si on publie pour la première fois → notifier
    if (justPublished) {
      await createNotificationsForPost(post.id, post.chamberId, post.title)
    }

    return reply.send({ data: { post } })
  })

  // ── DELETE /api/v1/chamber/posts/:id ────────────────────────────────────
  app.delete('/posts/:id', { preHandler: [authMiddleware, chamberMiddleware] }, async (request: any, reply) => {
    const { id } = request.params

    const existing = await prisma.chamberPost.findFirst({
      where: { id, chamberId: request.user.id },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Post introuvable', code: 'NOT_FOUND' })
    }

    await prisma.chamberPost.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── GET /api/v1/chamber/feed ─────────────────────────────────────────────
  // Cabinets voient tous les posts publiés (toutes chambres)
  // Inclut un flag "isRead" pour l'utilisateur connecté
  app.get('/feed', { preHandler: [authMiddleware] }, async (request, reply) => {
    const posts = await prisma.chamberPost.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      include: {
        chamber: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        reads: {
          where: { userId: request.user.id },
          select: { readAt: true },
        },
      },
    })

    const postsWithRead = posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
      chamber: p.chamber,
      isRead: p.reads.length > 0,
      readAt: p.reads[0]?.readAt ?? null,
    }))

    return reply.send({ data: { posts: postsWithRead } })
  })

  // ── PATCH /api/v1/chamber/posts/:id/read ─────────────────────────────────
  // Cabinet marque un post comme lu
  app.patch('/posts/:id/read', { preHandler: [authMiddleware] }, async (request: any, reply) => {
    const { id } = request.params

    const post = await prisma.chamberPost.findFirst({
      where: { id, status: 'published' },
      select: { id: true },
    })
    if (!post) {
      return reply.status(404).send({ error: 'Post introuvable', code: 'NOT_FOUND' })
    }

    await prisma.chamberPostRead.upsert({
      where: { postId_userId: { postId: id, userId: request.user.id } },
      create: { postId: id, userId: request.user.id },
      update: { readAt: new Date() },
    })

    return reply.send({ data: { ok: true } })
  })
}

// ── Utilitaire : créer les notifications pour tous les users actifs ─────────
async function createNotificationsForPost(postId: string, chamberId: string, title: string) {
  // Récupère tous les membres actifs de cabinets
  const members = await prisma.cabinetMember.findMany({
    where: { isActive: true },
    select: { userId: true, cabinetId: true },
  })

  if (members.length === 0) return

  // Récupère le nom de la chambre
  const chamber = await prisma.user.findUnique({
    where: { id: chamberId },
    select: { firstName: true, lastName: true, email: true },
  })
  const chamberName = chamber
    ? [chamber.firstName, chamber.lastName].filter(Boolean).join(' ') || chamber.email
    : 'Une chambre'

  await prisma.notification.createMany({
    data: members.map((m) => ({
      cabinetId: m.cabinetId,
      userId: m.userId,
      type: 'chamber_post_published',
      title: `Nouvelle communication : ${title}`,
      message: `${chamberName} a publié une nouvelle communication.`,
      entityType: 'chamber_post',
      entityId: postId,
    })),
    skipDuplicates: true,
  })
}
