/**
 * Helper qui construit une instance Fastify de test.
 * Les middlewares auth et cabinet sont mockés : on injecte directement
 * user et cabinetId sans passer par Supabase.
 */
import { vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { GlobalRole } from '@cgp/db'
import '../../../src/types' // augmentations FastifyRequest

// ── Mock des middlewares avant d'importer les routes ─────────────────────────
// authMiddleware et cabinetMiddleware seront des pass-through en test.
// Le hook onRequest ci-dessous injecte les vraies valeurs de test.
vi.mock('../../middleware/auth', () => ({
  authMiddleware: vi.fn(async () => {}),
}))

vi.mock('../../middleware/cabinet', () => ({
  cabinetMiddleware: vi.fn(async () => {}),
}))

vi.mock('../../middleware/admin', () => ({
  adminMiddleware: vi.fn(async () => {}),
}))

import { contactRoutes } from '../../routes/contacts'
import { documentRoutes } from '../../routes/documents'
import { folderRoutes } from '../../routes/folders'
import { tagRoutes } from '../../routes/tags'
import { trainingRoutes } from '../../routes/trainings'
import { shareRoutes } from '../../routes/shares'
import { complianceRoutes } from '../../routes/compliance'
import { adminRoutes } from '../../routes/admin'
import { cabinetRoutes } from '../../routes/cabinets'

export type TestUser = {
  id: string
  email: string
  globalRole: GlobalRole
  cabinetId?: string
}

export function buildApp(user: TestUser): FastifyInstance {
  const app = Fastify({ logger: false })

  // Décorateurs requis par les middlewares
  app.decorateRequest('user', null)
  app.decorateRequest('cabinetId', null)

  // Injecte user + cabinetId sur chaque requête (remplace auth réel)
  app.addHook('onRequest', async (request) => {
    request.user = { id: user.id, email: user.email, globalRole: user.globalRole }
    if (user.cabinetId) request.cabinetId = user.cabinetId
  })

  app.register(contactRoutes, { prefix: '/api/v1/contacts' })
  app.register(documentRoutes, { prefix: '/api/v1/documents' })
  app.register(folderRoutes, { prefix: '/api/v1/folders' })
  app.register(tagRoutes, { prefix: '/api/v1/tags' })
  app.register(trainingRoutes, { prefix: '/api/v1/trainings' })
  app.register(shareRoutes, { prefix: '/api/v1/shares' })
  app.register(complianceRoutes, { prefix: '/api/v1/compliance' })
  app.register(adminRoutes, { prefix: '/api/v1/admin' })
  app.register(cabinetRoutes, { prefix: '/api/v1/cabinets' })

  return app
}
