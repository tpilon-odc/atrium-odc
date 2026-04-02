import { z } from 'zod'
import { paginationQuery, publicRatingBody } from '../../lib/schemas'

export const listProductsQuery = paginationQuery.extend({
  mainCategory: z.enum(['assurance', 'cif']).optional(),
  category: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
})

export const createProductBody = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  website: z.string().optional(),
  isActive: z.boolean().optional(),
  mainCategory: z.enum(['assurance', 'cif']).nullable().optional(),
})

export const updateProductBody = createProductBody.partial()

export const upsertCabinetProductBody = z.object({
  isActive: z.boolean().optional(),
  isCommercialized: z.boolean().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  privateRating: z.number().int().min(1).max(5).nullable().optional(),
  privateNote: z.string().nullable().optional(),
  internalTags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
})

export { publicRatingBody }

export const linkSupplierBody = z.object({
  supplierId: z.string().uuid(),
})
