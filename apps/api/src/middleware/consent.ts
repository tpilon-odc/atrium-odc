import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'

/**
 * Vérifie que l'utilisateur authentifié a accepté la version CGU courante.
 * À placer APRÈS authMiddleware sur toutes les routes protégées.
 * Si non → 403 CONSENT_REQUIRED → le frontend redirige vers /consent.
 */
export async function consentMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const cguVersion = process.env.CGU_VERSION
  if (!cguVersion) return // pas de version configurée → on laisse passer

  const existing = await prisma.consentRecord.findFirst({
    where: {
      userId: request.user.id,
      version: cguVersion,
    },
  })

  if (!existing) {
    return reply.status(403).send({
      error: 'Vous devez accepter les CGU pour continuer',
      code: 'CONSENT_REQUIRED',
      requiredVersion: cguVersion,
    })
  }
}
