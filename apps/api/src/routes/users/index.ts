import { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { uploadToMinio, deleteFromMinio, getPresignedUrl, BUCKET } from '../../lib/minio'

const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const AVATAR_MAX_SIZE = 2 * 1024 * 1024 // 2 MB

const updateProfileBody = z.object({
  civility: z.enum(['M.', 'Mme']).nullable().optional(),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
})

export const userRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { limits: { fileSize: AVATAR_MAX_SIZE } })

  // PATCH /api/v1/users/me — mettre à jour le profil
  app.patch('/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = updateProfileBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        ...(result.data.civility !== undefined && { civility: result.data.civility }),
        ...(result.data.firstName !== undefined && { firstName: result.data.firstName }),
        ...(result.data.lastName !== undefined && { lastName: result.data.lastName }),
      },
      select: { id: true, email: true, civility: true, firstName: true, lastName: true, globalRole: true, avatarUrl: true },
    })

    return reply.send({ data: { user } })
  })

  // POST /api/v1/users/me/avatar — upload d'avatar vers MinIO
  app.post('/me/avatar', { preHandler: [authMiddleware] }, async (request, reply) => {
    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ error: 'Aucun fichier reçu', code: 'NO_FILE' })
    }

    if (!AVATAR_MIME_TYPES.has(data.mimetype)) {
      return reply.status(400).send({ error: 'Format non supporté. Utilisez JPEG, PNG ou WebP.', code: 'INVALID_TYPE' })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    if (buffer.length > AVATAR_MAX_SIZE) {
      return reply.status(400).send({ error: 'Fichier trop volumineux (max 2 Mo)', code: 'FILE_TOO_LARGE' })
    }

    const ext = data.mimetype.split('/')[1].replace('jpeg', 'jpg')
    const key = `avatars/${request.user.id}.${ext}`

    // Supprime l'ancien avatar si différent (ex: changement d'extension)
    const existing = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { avatarUrl: true },
    })
    if (existing?.avatarUrl) {
      const oldKey = existing.avatarUrl.split(`/${BUCKET}/`)[1]
      if (oldKey && oldKey !== key) {
        await deleteFromMinio(oldKey).catch(() => {})
      }
    }

    await uploadToMinio(key, buffer, data.mimetype)
    const avatarUrl = getPresignedUrl(key)

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: { avatarUrl },
      select: { id: true, email: true, firstName: true, lastName: true, globalRole: true, avatarUrl: true },
    })

    return reply.send({ data: { user } })
  })

  // GET /api/v1/users/search — recherche d'utilisateurs par email/nom (filtré par rôles)
  app.get('/search', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { q, roles } = request.query as { q?: string; roles?: string }

    if (!q || q.length < 2) {
      return reply.send({ data: { users: [] } })
    }

    const roleList = roles
      ? (roles.split(',').filter((r) =>
          ['chamber', 'regulator', 'platform_admin', 'cabinet_user'].includes(r)
        ) as string[])
      : undefined

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { isActive: true },
          { id: { not: request.user.id } },
          roleList?.length ? { globalRole: { in: roleList as any[] } } : {},
          {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, email: true, firstName: true, lastName: true, globalRole: true },
      take: 10,
    })

    return reply.send({ data: { users } })
  })

  // DELETE /api/v1/users/me/avatar — supprimer l'avatar
  app.delete('/me/avatar', { preHandler: [authMiddleware] }, async (request, reply) => {
    const existing = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { avatarUrl: true },
    })
    if (existing?.avatarUrl) {
      const key = existing.avatarUrl.split(`/${BUCKET}/`)[1]
      if (key) await deleteFromMinio(key).catch(() => {})
    }

    await prisma.user.update({
      where: { id: request.user.id },
      data: { avatarUrl: null },
    })

    return reply.status(204).send()
  })
}
