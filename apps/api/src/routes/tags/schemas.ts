import { z } from 'zod'

export const createTagBody = z.object({
  name: z.string().min(1, 'Le nom est requis').max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hexadécimale invalide').optional(),
})

export const updateTagBody = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
})
