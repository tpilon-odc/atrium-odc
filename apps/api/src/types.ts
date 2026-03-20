import { GlobalRole } from '@cgp/db'

export type AuthUser = {
  id: string
  email: string
  globalRole: GlobalRole
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser
    cabinetId: string
  }
}
