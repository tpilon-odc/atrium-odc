import { z } from 'zod'

// ── Admin schemas ─────────────────────────────────────────────────────────────

export const createPhaseBody = z.object({
  label: z.string().min(1, 'Le libellé est requis'),
  description: z.string().optional(),
  order: z.number().int().min(0),
  isActive: z.boolean().default(true),
})

export const updatePhaseBody = createPhaseBody.partial()

export const createItemBody = z.object({
  label: z.string().min(1, 'Le libellé est requis'),
  type: z.enum(['doc', 'text', 'radio', 'checkbox']),
  config: z.record(z.unknown()),
  isRequired: z.boolean().default(true),
  validityMonths: z.number().int().positive().nullable().optional(),
  alertBeforeDays: z.array(z.number().int().positive()).default([]),
  dueDaysAfterSignup: z.number().int().positive().nullable().optional(),
  order: z.number().int().min(0),
})

export const updateItemBody = createItemBody.partial()

export const createConditionBody = z.object({
  itemId: z.string().uuid(),
  dependsOnItemId: z.string().uuid(),
  operator: z.enum(['eq', 'not_eq', 'in', 'not_in']),
  expectedValue: z.string(),
})

// ── Cabinet schemas ───────────────────────────────────────────────────────────

// Valeur d'une réponse selon le type de l'item
const answerValueSchema = z.union([
  z.object({ document_id: z.string().uuid() }),           // doc
  z.object({ text: z.string() }),                          // text
  z.object({ selected: z.array(z.string()).length(1) }),   // radio
  z.object({ selected: z.array(z.string()).min(1) }),      // checkbox
])

export const submitAnswerBody = z.object({
  value: answerValueSchema,
  status: z.enum(['draft', 'submitted']).default('submitted'),
})

export type CreatePhaseBody = z.infer<typeof createPhaseBody>
export type CreateItemBody = z.infer<typeof createItemBody>
export type SubmitAnswerBody = z.infer<typeof submitAnswerBody>
