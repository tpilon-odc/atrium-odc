import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { minioNative, BUCKET } from '../../lib/minio'

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
}

async function proxyFile(key: string, reply: import('fastify').FastifyReply) {
  try {
    const stream = await minioNative.getObject(BUCKET, key)
    const ext = key.split('.').pop()?.toLowerCase()
    reply.header('Content-Type', (ext && CONTENT_TYPES[ext]) || 'application/octet-stream')
    reply.header('Cache-Control', 'private, max-age=3600')
    return reply.send(stream)
  } catch {
    return reply.status(404).send({ message: 'Fichier non trouvé' })
  }
}

export async function fileRoutes(app: FastifyInstance) {
  // Routes publiques — logos et avatars (pas de données sensibles)
  app.get<{ Params: { '*': string } }>('/public/*', async (request, reply) => {
    return proxyFile(request.params['*'], reply)
  })

  // Routes privées — documents cabinet (JWT requis)
  // Accepte le token en header Authorization OU en query param ?token=
  // (query param nécessaire pour <img src="...">, <a href="...">, window.open)
  app.addHook('preHandler', async (request, _reply) => {
    if (request.url.startsWith('/api/v1/files/public/')) return
    const queryToken = (request.query as { token?: string }).token
    if (queryToken && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${queryToken}`
    }
  })

  app.get<{ Params: { '*': string } }>(
    '/private/*',
    { preHandler: authMiddleware },
    async (request, reply) => {
      return proxyFile(request.params['*'], reply)
    }
  )
}
