import { FastifyRequest, FastifyReply } from 'fastify'
import { GlobalRole } from '@cgp/db'
import { prisma } from '../lib/prisma'

// Middleware pour les routes réservées aux utilisateurs avec globalRole === 'supplier'.
// Injecte request.supplierIds : liste des supplier_id que cet utilisateur peut gérer.
// À utiliser APRÈS authMiddleware.
export async function supplierMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.user?.globalRole !== GlobalRole.supplier) {
    return reply.status(403).send({ error: 'Réservé aux fournisseurs', code: 'FORBIDDEN' })
  }

  const links = await prisma.supplierUser.findMany({
    where: { userId: request.user.id },
    select: { supplierId: true },
  })

  request.supplierIds = links.map((l) => l.supplierId)
}
