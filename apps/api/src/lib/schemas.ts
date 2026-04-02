import { z } from 'zod'

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
