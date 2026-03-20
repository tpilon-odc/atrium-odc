import { z } from 'zod'

export const listContactsQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  type: z.enum(['prospect', 'client', 'ancien_client']).optional(),
})

export const createContactBody = z.object({
  lastName: z.string().min(1, 'Le nom est requis'),
  firstName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  type: z.enum(['prospect', 'client', 'ancien_client']),
  metadata: z.record(z.unknown()).optional(),
})

export const updateContactBody = createContactBody.partial()

export const createInteractionBody = z.object({
  type: z.enum(['email', 'appel', 'rdv', 'note']),
  note: z.string().optional(),
  occurredAt: z.string().datetime({ message: 'Date invalide (ISO 8601 attendu)' }),
})

export const updateInteractionBody = createInteractionBody.partial()
