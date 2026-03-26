import { z } from 'zod'

export const createCabinetBody = z.object({
  name: z.string().min(1, 'Le nom du cabinet est requis'),
  siret: z.string().optional(),
  oriasNumber: z.string().optional(),
})

export const updateCabinetBody = z.object({
  name: z.string().min(1).optional(),
  siret: z.string().optional(),
  oriasNumber: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
  description: z.string().optional(),
  city: z.string().optional(),
  website: z.string().url('URL invalide').optional().or(z.literal('')),
})

export const inviteMemberBody = z.object({
  email: z.string().email('Email invalide'),
  role: z.enum(['admin', 'member']).default('member'),
  canManageSuppliers: z.boolean().default(false),
  canManageProducts: z.boolean().default(false),
  canManageContacts: z.boolean().default(false),
})

export const updateMemberBody = z.object({
  role: z.enum(['admin', 'member']).optional(),
  canManageSuppliers: z.boolean().optional(),
  canManageProducts: z.boolean().optional(),
  canManageContacts: z.boolean().optional(),
})

export type CreateCabinetBody = z.infer<typeof createCabinetBody>
export type UpdateCabinetBody = z.infer<typeof updateCabinetBody>
export type InviteMemberBody = z.infer<typeof inviteMemberBody>
export type UpdateMemberBody = z.infer<typeof updateMemberBody>
