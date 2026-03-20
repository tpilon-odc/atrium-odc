import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'

// À utiliser APRÈS authMiddleware sur les routes qui nécessitent un cabinet actif
// Le header optionnel X-Cabinet-Id permet de sélectionner un cabinet spécifique
// (pour les utilisateurs membres de plusieurs cabinets)
export async function cabinetMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestedCabinetId = request.headers['x-cabinet-id'] as string | undefined

  const member = await prisma.cabinetMember.findFirst({
    where: {
      userId: request.user.id,
      deletedAt: null,
      ...(requestedCabinetId ? { cabinetId: requestedCabinetId } : {}),
    },
    orderBy: { cabinet: { createdAt: 'asc' } },
  })

  if (!member) {
    return reply.status(403).send({
      error: 'Aucun cabinet associé à ce compte',
      code: 'NO_CABINET',
    })
  }

  request.cabinetId = member.cabinetId
}
