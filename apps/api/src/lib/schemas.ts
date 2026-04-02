import { z } from 'zod'
import type { ZodTypeAny } from 'zod'
import { FastifyReply } from 'fastify'

// Pagination cursor-based partagée entre toutes les routes de liste
export const paginationQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
})

// Rating public partagé entre suppliers, products, tools
export const publicRatingBody = z.object({
  rating: z.number().int().min(1).max(5),
})

// Helper : parse + réponse 400 si invalide — évite le pattern répété dans toutes les routes
export function parseBody<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
  reply: FastifyReply
): { ok: true; data: z.output<S> } | { ok: false } {
  const result = schema.safeParse(data)
  if (!result.success) {
    reply.status(400).send({ error: result.error.errors[0].message, code: 'VALIDATION_ERROR' })
    return { ok: false }
  }
  return { ok: true, data: result.data }
}
