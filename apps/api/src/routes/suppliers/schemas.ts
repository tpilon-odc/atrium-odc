import { z } from 'zod'
import { paginationQuery, publicRatingBody } from '../../lib/schemas'

export const listSuppliersQuery = paginationQuery.extend({
  category: z.string().optional(),
})

export const createSupplierBody = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
})

export const updateSupplierBody = createSupplierBody.partial()

export const upsertCabinetSupplierBody = z.object({
  isActive: z.boolean().optional(),
  privateRating: z.number().int().min(1).max(5).nullable().optional(),
  privateNote: z.string().nullable().optional(),
  internalTags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
})

export { publicRatingBody }
