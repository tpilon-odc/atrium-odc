import { z } from 'zod'

export const listContactsQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  type: z.enum(['prospect', 'client', 'ancien_client']).optional(),
})

export const maritalStatusEnum = z.enum(['celibataire', 'marie', 'pacse', 'divorce', 'veuf'])

export const createContactBody = z.object({
  lastName: z.string().min(1, 'Le nom est requis'),
  firstName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  email2: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  type: z.enum(['prospect', 'client', 'ancien_client']),
  birthDate: z.string().date().optional().or(z.literal('')),
  profession: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  maritalStatus: maritalStatusEnum.optional(),
  dependents: z.coerce.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const updateContactBody = createContactBody.partial()

export const createInteractionBody = z.object({
  type: z.enum(['email', 'appel', 'rdv', 'note']),
  note: z.string().optional(),
  occurredAt: z.string().datetime({ message: 'Date invalide (ISO 8601 attendu)' }),
})

export const updateInteractionBody = createInteractionBody.partial()
