import { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { supabaseAdmin } from '../../lib/supabase'
import { prisma } from '../../lib/prisma'
import { signupBody, loginBody } from './schemas'

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/auth/signup
  app.post('/signup', async (request, reply) => {
    const result = signupBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        error: result.error.errors[0].message,
        code: 'VALIDATION_ERROR',
      })
    }

    const { email, password } = result.data

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Pas de confirmation email en dev
      app_metadata: { global_role: 'cabinet_user' },
    })

    if (error) {
      const isConflict = error.message.toLowerCase().includes('already')
      return reply.status(isConflict ? 409 : 400).send({
        error: isConflict ? 'Cet email est déjà utilisé' : error.message,
        code: isConflict ? 'EMAIL_TAKEN' : 'SIGNUP_ERROR',
      })
    }

    // Connexion immédiate pour obtenir un token
    const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !session.session) {
      return reply.status(201).send({ data: { user: data.user, session: null } })
    }

    return reply.status(201).send({ data: { user: data.user, session: session.session } })
  })

  // POST /api/v1/auth/login
  app.post('/login', async (request, reply) => {
    const result = loginBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        error: result.error.errors[0].message,
        code: 'VALIDATION_ERROR',
      })
    }

    const { email, password } = result.data

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
      return reply.status(401).send({
        error: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS',
      })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: data.user.id },
      select: { firstName: true, lastName: true },
    })

    return reply.send({
      data: {
        user: {
          id: data.user.id,
          email: data.user.email!,
          globalRole: (data.user.app_metadata?.global_role as string) ?? 'cabinet_user',
          firstName: dbUser?.firstName ?? null,
          lastName: dbUser?.lastName ?? null,
        },
        session: data.session,
      },
    })
  })

  // POST /api/v1/auth/logout
  app.post('/logout', { preHandler: [authMiddleware] }, async (request, reply) => {
    const token = request.headers.authorization!.split(' ')[1]
    await supabaseAdmin.auth.admin.signOut(token)
    return reply.send({ data: { message: 'Déconnecté avec succès' } })
  })

  // GET /api/v1/auth/me
  app.get('/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const dbUser = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { firstName: true, lastName: true },
    })
    return reply.send({
      data: {
        user: {
          ...request.user,
          firstName: dbUser?.firstName ?? null,
          lastName: dbUser?.lastName ?? null,
        },
      },
    })
  })
}
