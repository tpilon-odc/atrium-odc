import { FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAdmin } from '../lib/supabase'
import { GlobalRole } from '@cgp/db'
import { prisma } from '../lib/prisma'

// Routes exemptées de la vérification de consentement CGU
const CONSENT_EXEMPT_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/consent',
  '/api/v1/cabinets', // onboarding — création cabinet avant acceptation CGU
  '/health',
]

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

  // La source de vérité du rôle est la DB (les invitations admin définissent le rôle en DB).
  // app_metadata n'est utilisé qu'en fallback pour les nouveaux comptes (inscription libre).
  const existingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { globalRole: true },
  })

  const globalRole = existingUser?.globalRole
    ?? (user.app_metadata?.global_role as GlobalRole)
    ?? GlobalRole.cabinet_user

  // S'assure que l'utilisateur existe dans la DB — ne jamais écraser le globalRole existant
  await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email!, globalRole },
    update: { email: user.email! },
  })

  request.user = {
    id: user.id,
    email: user.email!,
    globalRole,
  }

  // Vérification consentement CGU — sauf sur les routes exemptées
  const cguVersion = process.env.CGU_VERSION
  if (!cguVersion) return

  const isExempt = CONSENT_EXEMPT_PREFIXES.some((p) => request.url.startsWith(p))
  if (isExempt) return

  const hasConsent = await prisma.consentRecord.findFirst({
    where: { userId: user.id, version: cguVersion },
    select: { id: true },
  })

  if (!hasConsent) {
    return reply.status(403).send({
      error: 'Vous devez accepter les CGU pour continuer',
      code: 'CONSENT_REQUIRED',
      requiredVersion: cguVersion,
    })
  }
}
