const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type ApiResponse<T> = { data: T }

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
  }
}

async function call<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<ApiResponse<T>> {
  const { token, ...fetchOptions } = options ?? {}

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers ?? {}),
    },
  })

  if (res.status === 204) {
    return {} as ApiResponse<T>
  }

  const json = await res.json()

  if (!res.ok) {
    throw new ApiError(json.error ?? 'Erreur API', json.code ?? 'UNKNOWN', res.status)
  }

  return json as ApiResponse<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

type Session = {
  access_token: string
  refresh_token: string
  expires_in: number
}

type UserInfo = {
  id: string
  email: string
  globalRole: string
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
}

export function displayName(user: Pick<UserInfo, 'email' | 'firstName' | 'lastName'>): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return name || user.email.split('@')[0]
}

export const userApi = {
  updateProfile: (data: { firstName?: string | null; lastName?: string | null }, token: string) =>
    call<{ user: UserInfo }>('/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  uploadAvatar: async (file: File, token: string) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/api/v1/users/me/avatar`, {
      method: 'POST',
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (!res.ok) throw new ApiError(json.error ?? 'Erreur API', json.code ?? 'UNKNOWN', res.status)
    return json as { data: { user: UserInfo } }
  },

  deleteAvatar: (token: string) =>
    call<unknown>('/api/v1/users/me/avatar', { method: 'DELETE', token }),
}

export const authApi = {
  signup: (email: string, password: string) =>
    call<{ user: UserInfo; session: Session | null }>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    call<{ user: UserInfo; session: Session }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: (token: string) =>
    call<{ message: string }>('/api/v1/auth/logout', {
      method: 'POST',
      token,
    }),

  me: (token: string) =>
    call<{ user: UserInfo }>('/api/v1/auth/me', { token }),
}

// ── Cabinets ──────────────────────────────────────────────────────────────────

type Cabinet = {
  id: string
  name: string
  subscriptionStatus: string
}

export const cabinetApi = {
  create: (name: string, token: string) =>
    call<{ cabinet: Cabinet }>('/api/v1/cabinets', {
      method: 'POST',
      body: JSON.stringify({ name }),
      token,
    }),

  getMe: (token: string) =>
    call<{ cabinet: Cabinet }>('/api/v1/cabinets/me', { token }),

  update: (data: { name?: string }, token: string) =>
    call<{ cabinet: Cabinet }>('/api/v1/cabinets/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),
}

// ── Conformité ────────────────────────────────────────────────────────────────

export type PhaseProgress = {
  id: string
  name: string
  order: number
  progress: { total: number; completed: number; percentage: number; status: string }
  items: Array<{
    id: string
    label: string
    type: string
    validityMonths: number | null
    answer: { status: string; expiresAt: string | null } | null
    status: string
  }>
}

export type AnswerValue =
  | { document_id: string }
  | { text: string }
  | { selected: string[] }

export const complianceApi = {
  getProgress: (token: string) =>
    call<{ globalProgress: number; phases: PhaseProgress[] }>(
      '/api/v1/compliance/progress',
      { token }
    ),

  getAnswers: (token: string) =>
    call<{ answers: Array<{ itemId: string; status: string; value: unknown; expiresAt: string | null; submittedAt: string | null }> }>(
      '/api/v1/compliance/answers',
      { token }
    ),

  submitAnswer: (itemId: string, value: AnswerValue, status: 'draft' | 'submitted', token: string) =>
    call<{ answer: unknown }>(`/api/v1/compliance/answers/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ value, status }),
      token,
    }),
}

// ── Fournisseurs ──────────────────────────────────────────────────────────────

export type Supplier = {
  id: string
  name: string
  description: string | null
  category: string | null
  website: string | null
  email: string | null
  phone: string | null
  avgPublicRating: number | null
  isVerified: boolean
  createdAt: string
  cabinetData: {
    isActive: boolean
    privateRating: number | null
    privateNote: string | null
    internalTags: string[]
  } | null
  myPublicRating: number | null
}

export type SupplierDetail = Supplier & {
  creator: { id: string; email: string }
  editsCount: number
}

export const supplierApi = {
  list: (token: string, params?: { limit?: number; cursor?: string; search?: string; category?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.search) q.set('search', params.search)
    if (params?.category) q.set('category', params.category)
    return call<{ suppliers: Supplier[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/v1/suppliers?${q}`,
      { token }
    )
  },

  get: (id: string, token: string) =>
    call<{ supplier: SupplierDetail; cabinetData: Supplier['cabinetData']; myPublicRating: number | null; editsCount: number }>(
      `/api/v1/suppliers/${id}`,
      { token }
    ),

  create: (data: { name: string; description?: string; category?: string; website?: string; email?: string; phone?: string }, token: string) =>
    call<{ supplier: Supplier }>('/api/v1/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: Partial<{ name: string; description: string; category: string; website: string; email: string; phone: string }>, token: string) =>
    call<{ supplier: Supplier }>(`/api/v1/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  upsertCabinet: (id: string, data: { isActive?: boolean; privateRating?: number | null; privateNote?: string | null; internalTags?: string[] }, token: string) =>
    call<{ cabinetData: Supplier['cabinetData'] }>(`/api/v1/suppliers/${id}/cabinet`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  rate: (id: string, rating: number, token: string) =>
    call<{ rating: unknown }>(`/api/v1/suppliers/${id}/rating`, {
      method: 'PUT',
      body: JSON.stringify({ rating }),
      token,
    }),
}

// ── Produits ──────────────────────────────────────────────────────────────────

export type Product = {
  id: string
  name: string
  description: string | null
  category: string | null
  website: string | null
  avgPublicRating: number | null
  isVerified: boolean
  createdAt: string
  cabinetData: {
    isActive: boolean
    isCommercialized: boolean
    supplierId: string | null
    privateRating: number | null
    privateNote: string | null
    internalTags: string[]
  } | null
  myPublicRating: number | null
}

export type ProductDetail = Product & {
  creator: { id: string; email: string }
  supplierLinks: Array<{ id: string; supplierId: string; supplier: { id: string; name: string } }>
}

export const productApi = {
  list: (token: string, params?: { limit?: number; cursor?: string; search?: string; category?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.search) q.set('search', params.search)
    if (params?.category) q.set('category', params.category)
    return call<{ products: Product[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/v1/products?${q}`,
      { token }
    )
  },

  get: (id: string, token: string) =>
    call<{ product: ProductDetail; cabinetData: Product['cabinetData']; myPublicRating: number | null }>(
      `/api/v1/products/${id}`,
      { token }
    ),

  create: (data: { name: string; description?: string; category?: string; website?: string }, token: string) =>
    call<{ product: Product }>('/api/v1/products', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: Partial<{ name: string; description: string; category: string; website: string }>, token: string) =>
    call<{ product: Product }>(`/api/v1/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  upsertCabinet: (id: string, data: { isActive?: boolean; isCommercialized?: boolean; supplierId?: string | null; privateNote?: string | null; internalTags?: string[] }, token: string) =>
    call<{ cabinetData: Product['cabinetData'] }>(`/api/v1/products/${id}/cabinet`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  rate: (id: string, rating: number, token: string) =>
    call<{ rating: unknown }>(`/api/v1/products/${id}/rating`, {
      method: 'PUT',
      body: JSON.stringify({ rating }),
      token,
    }),

  linkSupplier: (id: string, supplierId: string, token: string) =>
    call<{ link: unknown }>(`/api/v1/products/${id}/suppliers`, {
      method: 'POST',
      body: JSON.stringify({ supplierId }),
      token,
    }),

  unlinkSupplier: (id: string, supplierId: string, token: string) =>
    call<unknown>(`/api/v1/products/${id}/suppliers/${supplierId}`, {
      method: 'DELETE',
      token,
    }),
}

// ── Outils ────────────────────────────────────────────────────────────────────

export type Tool = {
  id: string
  name: string
  description: string | null
  category: string | null
  url: string | null
  avgPublicRating: number | null
  isVerified: boolean
  createdAt: string
  cabinetData: {
    isActive: boolean
    privateRating: number | null
    privateNote: string | null
    internalTags: string[]
  } | null
  myPublicRating: number | null
}

export const toolApi = {
  list: (token: string, params?: { limit?: number; cursor?: string; search?: string; category?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.search) q.set('search', params.search)
    if (params?.category) q.set('category', params.category)
    return call<{ tools: Tool[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/v1/tools?${q}`,
      { token }
    )
  },

  get: (id: string, token: string) =>
    call<{ tool: Tool & { creator: { id: string; email: string } }; cabinetData: Tool['cabinetData']; myPublicRating: number | null }>(
      `/api/v1/tools/${id}`,
      { token }
    ),

  create: (data: { name: string; description?: string; category?: string; url?: string }, token: string) =>
    call<{ tool: Tool }>('/api/v1/tools', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: Partial<{ name: string; description: string; category: string; url: string }>, token: string) =>
    call<{ tool: Tool }>(`/api/v1/tools/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  upsertCabinet: (id: string, data: { isActive?: boolean; privateNote?: string | null; internalTags?: string[] }, token: string) =>
    call<{ cabinetData: Tool['cabinetData'] }>(`/api/v1/tools/${id}/cabinet`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  rate: (id: string, rating: number, token: string) =>
    call<{ rating: unknown }>(`/api/v1/tools/${id}/rating`, {
      method: 'PUT',
      body: JSON.stringify({ rating }),
      token,
    }),
}

// ── Contacts / CRM ────────────────────────────────────────────────────────────

export type ContactType = 'prospect' | 'client' | 'ancien_client'
export type InteractionType = 'email' | 'appel' | 'rdv' | 'note'

export type Contact = {
  id: string
  firstName: string | null
  lastName: string
  email: string | null
  phone: string | null
  type: ContactType
  createdAt: string
}

export type Interaction = {
  id: string
  type: InteractionType
  note: string | null
  occurredAt: string
  user: { id: string; email: string }
}

export const contactApi = {
  list: (token: string, params?: { limit?: number; cursor?: string; search?: string; type?: ContactType }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.search) q.set('search', params.search)
    if (params?.type) q.set('type', params.type)
    return call<{ contacts: Contact[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/v1/contacts?${q}`,
      { token }
    )
  },

  get: (id: string, token: string) =>
    call<{ contact: Contact & { interactions: Interaction[] } }>(
      `/api/v1/contacts/${id}`,
      { token }
    ),

  create: (data: { lastName: string; firstName?: string; email?: string; phone?: string; type: ContactType }, token: string) =>
    call<{ contact: Contact }>('/api/v1/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: Partial<{ lastName: string; firstName: string; email: string; phone: string; type: ContactType }>, token: string) =>
    call<{ contact: Contact }>(`/api/v1/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/contacts/${id}`, { method: 'DELETE', token }),

  addInteraction: (contactId: string, data: { type: InteractionType; note?: string; occurredAt: string }, token: string) =>
    call<{ interaction: Interaction }>(`/api/v1/contacts/${contactId}/interactions`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  deleteInteraction: (contactId: string, interactionId: string, token: string) =>
    call<unknown>(`/api/v1/contacts/${contactId}/interactions/${interactionId}`, {
      method: 'DELETE',
      token,
    }),
}

// ── Admin compliance ──────────────────────────────────────────────────────────

export type CompliancePhase = {
  id: string
  label: string
  description: string | null
  order: number
  isActive: boolean
  items: ComplianceItem[]
}

export type ComplianceItem = {
  id: string
  phaseId: string
  label: string
  type: 'doc' | 'text' | 'radio' | 'checkbox'
  config: Record<string, unknown>
  isRequired: boolean
  validityMonths: number | null
  alertBeforeDays: number[]
  dueDaysAfterSignup: number | null
  order: number
  conditions: ComplianceCondition[]
}

export type ComplianceCondition = {
  id: string
  itemId: string
  dependsOnItemId: string
  operator: 'eq' | 'not_eq' | 'in' | 'not_in'
  expectedValue: string
}

export const adminComplianceApi = {
  getPhases: (token: string, all = false) =>
    call<{ phases: CompliancePhase[] }>(`/api/v1/compliance/phases${all ? '?all=true' : ''}`, { token }),

  createPhase: (data: { label: string; description?: string; order: number }, token: string) =>
    call<{ phase: CompliancePhase }>('/api/v1/compliance/phases', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updatePhase: (phaseId: string, data: Partial<{ label: string; description: string; order: number; isActive: boolean }>, token: string) =>
    call<{ phase: CompliancePhase }>(`/api/v1/compliance/phases/${phaseId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  deletePhase: (phaseId: string, token: string) =>
    call<unknown>(`/api/v1/compliance/phases/${phaseId}`, { method: 'DELETE', token }),

  createItem: (phaseId: string, data: {
    label: string; type: string; config: Record<string, unknown>; isRequired: boolean; order: number
    validityMonths?: number | null; alertBeforeDays?: number[]; dueDaysAfterSignup?: number | null
  }, token: string) =>
    call<{ item: ComplianceItem }>(`/api/v1/compliance/phases/${phaseId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateItem: (itemId: string, data: Partial<{
    label: string; type: string; isRequired: boolean; order: number
    validityMonths: number | null; alertBeforeDays: number[]; dueDaysAfterSignup: number | null
    config: Record<string, unknown>
  }>, token: string) =>
    call<{ item: ComplianceItem }>(`/api/v1/compliance/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  deleteItem: (itemId: string, token: string) =>
    call<unknown>(`/api/v1/compliance/items/${itemId}`, { method: 'DELETE', token }),

  addCondition: (data: { itemId: string; dependsOnItemId: string; operator: string; expectedValue: string }, token: string) =>
    call<{ condition: ComplianceCondition }>('/api/v1/compliance/conditions', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  removeCondition: (conditionId: string, token: string) =>
    call<unknown>(`/api/v1/compliance/conditions/${conditionId}`, { method: 'DELETE', token }),

  getItemAnswerCount: (itemId: string, token: string) =>
    call<{ count: number }>(`/api/v1/compliance/items/${itemId}/answer-count`, { token }),
}

// ── Formations ────────────────────────────────────────────────────────────────

export type TrainingCatalogEntry = {
  id: string
  name: string
  organizer: string | null
  category: string | null
  defaultHours: number | null
  isVerified: boolean
  createdBy: string
}

export type CollaboratorTraining = {
  id: string
  cabinetId: string
  userId: string
  trainingId: string
  trainingDate: string
  hoursCompleted: number | null
  certificateDocumentId: string | null
  notes: string | null
  training: TrainingCatalogEntry
  user: { id: string; email: string }
}

export const trainingApi = {
  listCatalog: (token: string, search?: string) => {
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    return call<{ catalog: TrainingCatalogEntry[] }>(`/api/v1/trainings/catalog?${q}`, { token })
  },

  createCatalogEntry: (data: { name: string; organizer?: string; category?: string; defaultHours?: number }, token: string) =>
    call<{ entry: TrainingCatalogEntry }>('/api/v1/trainings/catalog', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  list: (token: string, params?: { userId?: string; cursor?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.userId) q.set('userId', params.userId)
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.limit) q.set('limit', String(params.limit))
    return call<{ trainings: CollaboratorTraining[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/v1/trainings?${q}`, { token }
    )
  },

  create: (data: { userId: string; trainingId: string; trainingDate: string; hoursCompleted?: number; notes?: string }, token: string) =>
    call<{ training: CollaboratorTraining }>('/api/v1/trainings', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/trainings/${id}`, { method: 'DELETE', token }),
}

// ── Partage ────────────────────────────────────────────────────────────────────

export type Share = {
  id: string
  cabinetId: string
  grantedBy: string
  grantedTo: string
  entityType: string
  entityId: string | null
  isActive: boolean
  createdAt: string
  recipientUser?: { id: string; email: string }
  granterUser?: { id: string; email: string }
  cabinet?: { id: string; name: string }
}

export const shareApi = {
  listGranted: (token: string) =>
    call<{ shares: Share[] }>('/api/v1/shares', { token }),

  listReceived: (token: string) =>
    call<{ shares: Share[] }>('/api/v1/shares/received', { token }),

  create: (data: { grantedTo: string; entityType: string; entityId?: string }, token: string) =>
    call<{ share: Share }>('/api/v1/shares', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  revoke: (id: string, token: string) =>
    call<unknown>(`/api/v1/shares/${id}`, { method: 'DELETE', token }),
}

// ── Cabinet (paramètres) ───────────────────────────────────────────────────────

export type CabinetMember = {
  id: string
  cabinetId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  canManageSuppliers: boolean
  canManageProducts: boolean
  canManageContacts: boolean
  createdAt: string
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null; globalRole: string }
}

export type StorageConfig = {
  id: string
  cabinetId: string
  provider: string
  label: string
  baseUrl: string
  createdAt: string
}

export const memberApi = {
  list: (token: string) =>
    call<{ members: CabinetMember[] }>('/api/v1/cabinets/me/members', { token }),

  invite: (data: { email: string; role?: 'admin' | 'member'; canManageSuppliers?: boolean; canManageProducts?: boolean; canManageContacts?: boolean }, token: string) =>
    call<{ member: CabinetMember }>('/api/v1/cabinets/me/members/invite', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (memberId: string, data: { role?: 'admin' | 'member'; canManageSuppliers?: boolean; canManageProducts?: boolean; canManageContacts?: boolean }, token: string) =>
    call<{ member: CabinetMember }>(`/api/v1/cabinets/me/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  remove: (memberId: string, token: string) =>
    call<unknown>(`/api/v1/cabinets/me/members/${memberId}`, { method: 'DELETE', token }),
}

export const storageConfigApi = {
  list: (token: string) =>
    call<{ configs: StorageConfig[] }>('/api/v1/storage-configs', { token }),

  create: (data: { provider: string; label: string; baseUrl: string }, token: string) =>
    call<{ config: StorageConfig }>('/api/v1/storage-configs', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/storage-configs/${id}`, { method: 'DELETE', token }),
}

// ── Documents ─────────────────────────────────────────────────────────────────

export type Document = {
  id: string
  name: string
  description: string | null
  storageMode: 'hosted' | 'external'
  mimeType: string | null
  sizeBytes: string | null
  createdAt: string
  links: DocumentLink[]
}

export type DocumentLink = {
  id: string
  documentId: string
  entityType: string
  entityId: string
  label: string | null
}

export const documentApi = {
  list: (token: string, params?: { limit?: number; cursor?: string; entityType?: string; entityId?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.entityType) q.set('entityType', params.entityType)
    if (params?.entityId) q.set('entityId', params.entityId)
    return call<{ documents: Document[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/v1/documents?${q}`,
      { token }
    )
  },

  get: (id: string, token: string) =>
    call<{ document: Document }>(`/api/v1/documents/${id}`, { token }),

  getUrl: (id: string, token: string) =>
    call<{ url: string; expiresIn: number | null }>(`/api/v1/documents/${id}/url`, { token }),

  upload: async (file: File, token: string) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/api/v1/documents/upload`, {
      method: 'POST',
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (!res.ok) throw new ApiError(json.error ?? 'Erreur API', json.code ?? 'UNKNOWN', res.status)
    return json as { data: { document: Document } }
  },

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/documents/${id}`, { method: 'DELETE', token }),

  rename: (id: string, name: string, token: string) =>
    call<{ document: Document }>(`/api/v1/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
      token,
    }),

  addLink: (documentId: string, entityType: string, entityId: string, token: string) =>
    call<{ link: DocumentLink }>(`/api/v1/documents/${documentId}/links`, {
      method: 'POST',
      body: JSON.stringify({ entityType, entityId }),
      token,
    }),

  removeLink: (documentId: string, linkId: string, token: string) =>
    call<unknown>(`/api/v1/documents/${documentId}/links/${linkId}`, {
      method: 'DELETE',
      token,
    }),
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type AppNotification = {
  id: string
  cabinetId: string
  userId: string
  type: 'compliance_expiring' | 'compliance_expired' | string
  title: string
  message: string
  entityType: string
  entityId: string
  isRead: boolean
  createdAt: string
}

export const notificationApi = {
  list: (token: string, params?: { all?: boolean; cursor?: string }) => {
    const q = new URLSearchParams()
    if (params?.all) q.set('all', 'true')
    if (params?.cursor) q.set('cursor', params.cursor)
    return call<{ notifications: AppNotification[]; unreadCount: number; nextCursor: string | null }>(
      `/api/v1/notifications?${q}`,
      { token }
    )
  },

  markRead: (id: string, token: string) =>
    call<{ notification: AppNotification }>(`/api/v1/notifications/${id}/read`, {
      method: 'PATCH',
      body: JSON.stringify({}),
      token,
    }),

  markAllRead: (token: string) =>
    call<{ message: string }>('/api/v1/notifications/read-all', {
      method: 'PATCH',
      body: JSON.stringify({}),
      token,
    }),
}
