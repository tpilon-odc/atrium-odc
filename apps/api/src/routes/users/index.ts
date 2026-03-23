import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'

const updateProfileBody = z.object({
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
})

export const userRoutes: FastifyPluginAsync = async (app) => {
  // PATCH /api/v1/users/me — mettre à jour le profil
  app.patch('/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = updateProfileBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    }

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        ...(result.data.firstName !== undefined && { firstName: result.data.firstName }),
        ...(result.data.lastName !== undefined && { lastName: result.data.lastName }),
      },
      select: { id: true, email: true, firstName: true, lastName: true, globalRole: true },
    })

    return reply.send({ data: { user } })
  })
}
