import { z } from 'zod'

export const supplierSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
})

export const productSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  website: z.string().optional(),
  mainCategory: z.enum(['assurance', 'cif']).nullable().optional(),
})

export const toolSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  url: z.string().optional(),
})

export const contactSchema = z.object({
  lastName: z.string().min(1, 'Le nom est requis'),
  firstName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  email2: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  type: z.enum(['prospect', 'client', 'ancien_client']),
  birthDate: z.string().optional(),
  profession: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  maritalStatus: z.enum(['celibataire', 'marie', 'pacse', 'divorce', 'veuf']).optional(),
  dependents: z.coerce.number().int().min(0).optional(),
})

export type SupplierFormData = z.infer<typeof supplierSchema>
export type ProductFormData = z.infer<typeof productSchema>
export type ToolFormData = z.infer<typeof toolSchema>
export type ContactFormData = z.infer<typeof contactSchema>
