import { FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAdmin } from '../lib/supabase'
import { GlobalRole } from '@cgp/db'
import { prisma } from '../lib/prisma'

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Token manquant', code: 'MISSING_TOKEN' })
  }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !user) {
    return reply.status(401).send({ error: 'Token invalide', code: 'INVALID_TOKEN' })
  }

  // global_role est stocké dans app_metadata lors de la création du compte
  const globalRole = (user.app_metadata?.global_role as GlobalRole) ?? GlobalRole.cabinet_user

  // S'assure que l'utilisateur existe dans la DB (première connexion, invitation, etc.)
  await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email!, globalRole },
    update: { email: user.email!, globalRole },
  })

  request.user = {
    id: user.id,
    email: user.email!,
    globalRole,
  }
}
