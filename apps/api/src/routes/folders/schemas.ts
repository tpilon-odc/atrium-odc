import { z } from 'zod'

export const createFolderBody = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100),
  parentId: z.string().uuid().optional(),
  order: z.number().int().min(0).default(0),
})

export const updateFolderBody = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0).optional(),
})
