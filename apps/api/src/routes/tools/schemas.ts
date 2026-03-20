import { z } from 'zod'

export const listToolsQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
})

export const createToolBody = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  url: z.string().optional(),
})

export const updateToolBody = createToolBody.partial()

export const upsertCabinetToolBody = z.object({
  isActive: z.boolean().optional(),
  privateRating: z.number().int().min(1).max(5).nullable().optional(),
  privateNote: z.string().nullable().optional(),
  internalTags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
})

export const publicRatingBody = z.object({
  rating: z.number().int().min(1).max(5),
})
