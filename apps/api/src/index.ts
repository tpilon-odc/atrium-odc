import 'dotenv/config'
import './types' // Augmentations Fastify
import Fastify from 'fastify'
import cron from 'node-cron'
import { runComplianceNotificationsJob } from './jobs/compliance-notifications'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { authRoutes } from './routes/auth'
import { cabinetRoutes } from './routes/cabinets'
import { complianceRoutes } from './routes/compliance'
import { supplierRoutes } from './routes/suppliers'
import { productRoutes } from './routes/products'
import { toolRoutes } from './routes/tools'
import { contactRoutes } from './routes/contacts'
import { documentRoutes } from './routes/documents'
import { storageConfigRoutes } from './routes/storage-configs'
import { trainingRoutes } from './routes/trainings'
import { shareRoutes } from './routes/shares'
import { webhookRoutes } from './routes/webhooks'
import { exportRoutes } from './routes/exports'
import { userRoutes } from './routes/users'
import { notificationRoutes } from './routes/notifications'

const app = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
})

const start = async () => {
  // Documentation OpenAPI
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CGP Platform API',
        description: 'API de la plateforme CGP — gestion de cabinets de conseil en gestion de patrimoine',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${process.env.PORT || 3001}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  })
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  })

  // Plugins de sécurité
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
  await app.register(helmet, { contentSecurityPolicy: false })

  // Décorateurs pour les propriétés injectées par les middlewares
  app.decorateRequest('user', null)
  app.decorateRequest('cabinetId', null)

  // Routes
  app.register(authRoutes, { prefix: '/api/v1/auth' })
  app.register(cabinetRoutes, { prefix: '/api/v1/cabinets' })
  app.register(complianceRoutes, { prefix: '/api/v1/compliance' })
  app.register(supplierRoutes, { prefix: '/api/v1/suppliers' })
  app.register(productRoutes, { prefix: '/api/v1/products' })
  app.register(toolRoutes, { prefix: '/api/v1/tools' })
  app.register(contactRoutes, { prefix: '/api/v1/contacts' })
  app.register(documentRoutes, { prefix: '/api/v1/documents' })
  app.register(storageConfigRoutes, { prefix: '/api/v1/storage-configs' })
  app.register(trainingRoutes, { prefix: '/api/v1/trainings' })
  app.register(shareRoutes, { prefix: '/api/v1/shares' })
  app.register(webhookRoutes, { prefix: '/api/v1/webhooks' })
  app.register(exportRoutes, { prefix: '/api/v1/exports' })
  app.register(userRoutes, { prefix: '/api/v1/users' })
  app.register(notificationRoutes, { prefix: '/api/v1/notifications' })

  // Health check
  app.get('/health', async () => ({ status: 'ok' }))

  // Job nuit à 6h UTC — notifications expiration conformité
  cron.schedule('0 6 * * *', () => {
    runComplianceNotificationsJob().catch((err) =>
      app.log.error({ err }, '[compliance-notifications] Erreur job')
    )
  })
  app.log.info('Job compliance-notifications planifié (0 6 * * *)')

  const port = parseInt(process.env.PORT || '3001')
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`API démarrée sur http://localhost:${port}`)
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
