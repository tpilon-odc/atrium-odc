import { z } from 'zod'

export const listClustersQuery = z.object({
  search: z.string().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const createClusterBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  isPublic: z.boolean().default(true),
  avatarUrl: z.string().url().nullable().optional(),
})

export const updateClusterBody = createClusterBody.partial()

export const inviteCabinetBody = z.object({
  cabinetId: z.string().uuid(),
})

export const createChannelBody = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['ASYNC', 'REALTIME']).default('ASYNC'),
  isPrivate: z.boolean().default(false),
})

export const updateChannelBody = createChannelBody.partial()

export const listMessagesQuery = z.object({
  parentId: z.string().uuid().nullable().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
})

export const createMessageBody = z.object({
  content: z.string().min(1).max(10000),
  parentId: z.string().uuid().nullable().optional(),
})

export const updateMessageBody = z.object({
  content: z.string().min(1).max(10000),
})

export const reactionBody = z.object({
  emoji: z.string().min(1).max(10),
})

export const reportBody = z.object({
  reason: z.string().min(1).max(500),
})

export const updateReportBody = z.object({
  status: z.enum(['REVIEWED', 'DISMISSED']),
})
