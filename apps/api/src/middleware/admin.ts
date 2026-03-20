import { FastifyRequest, FastifyReply } from 'fastify'

// À utiliser APRÈS authMiddleware
export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.user.globalRole !== 'platform_admin') {
    return reply.status(403).send({
      error: 'Accès réservé aux administrateurs de la plateforme',
      code: 'FORBIDDEN',
    })
  }
}
