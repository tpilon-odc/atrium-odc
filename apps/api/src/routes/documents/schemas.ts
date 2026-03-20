import { z } from 'zod'

export const externalDocumentBody = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  externalConfigId: z.string().uuid('ID de config invalide'),
  externalPath: z.string().min(1, 'Le chemin est requis'),
  mimeType: z.string().optional(),
})

export const updateDocumentBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})

export const createDocumentLinkBody = z.object({
  entityType: z.enum(['cabinet', 'contact', 'product', 'supplier', 'compliance_answer']),
  entityId: z.string().uuid(),
  label: z.string().optional(),
})

export const listDocumentsQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z.enum(['cabinet', 'contact', 'product', 'supplier', 'compliance_answer']).optional(),
  entityId: z.string().uuid().optional(),
})
