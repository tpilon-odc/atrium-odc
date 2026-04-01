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
      ...(fetchOptions.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers ?? {}),
    },
  })

  if (res.status === 204) {
    return {} as ApiResponse<T>
  }

  // Token expiré ou invalide → déconnexion immédiate
  if (res.status === 401) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    localStorage.removeItem('cabinet')
    window.location.href = '/login?reason=session_expired'
    throw new ApiError('Session expirée', 'SESSION_EXPIRED', 401)
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
  civility?: 'M.' | 'Mme' | null
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
  updateProfile: (data: { civility?: 'M.' | 'Mme' | null; firstName?: string | null; lastName?: string | null }, token: string) =>
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

// ── Cabinets (public — sans auth) ────────────────────────────────────────────

export type CabinetMemberAnonymous = {
  id: string
  role: string
  externalFirstName: string | null
  externalLastName: string | null
  externalTitle: string | null
  user: {
    civility: string | null
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  } | null
}

export type CabinetPublicAnonymous = {
  id: string
  name: string
  description: string | null
  city: string | null
  website: string | null
  oriasNumber: string | null
  logoUrl: string | null
  createdAt: string
  members: CabinetMemberAnonymous[]
}

export const publicCabinetApi = {
  list: ({ search, cursor, limit }: { search?: string; cursor?: string; limit?: number } = {}) => {
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    if (cursor) q.set('cursor', cursor)
    if (limit) q.set('limit', String(limit))
    return call<{ cabinets: CabinetDirectoryItem[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/v1/public/cabinets?${q}`
    )
  },

  getById: (id: string) =>
    call<{ cabinet: CabinetPublicAnonymous }>(`/api/v1/public/cabinets/${id}`),
}

// ── Cabinets ──────────────────────────────────────────────────────────────────

export type CabinetMemberPublic = {
  id: string
  role: string
  externalFirstName: string | null
  externalLastName: string | null
  externalEmail: string | null
  externalTitle: string | null
  user: {
    id: string
    civility: string | null
    firstName: string | null
    lastName: string | null
    email: string
    avatarUrl: string | null
  } | null
}

export type CabinetPublic = {
  id: string
  name: string
  description: string | null
  city: string | null
  website: string | null
  siret: string | null
  oriasNumber: string | null
  logoUrl: string | null
  createdAt: string
  members: CabinetMemberPublic[]
}

export type CabinetDirectoryItem = {
  id: string
  name: string
  description: string | null
  city: string | null
  website: string | null
  oriasNumber: string | null
  logoUrl: string | null
  createdAt: string
  _count: { members: number }
}

type Cabinet = {
  id: string
  name: string
  subscriptionStatus: string
  description: string | null
  city: string | null
  website: string | null
  siret: string | null
  oriasNumber: string | null
  logoUrl: string | null
}

export type UpdateCabinetData = {
  name?: string
  siret?: string
  oriasNumber?: string
  description?: string
  city?: string
  website?: string
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

  update: (data: UpdateCabinetData, token: string) =>
    call<{ cabinet: Cabinet }>('/api/v1/cabinets/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  list: (token: string, params?: { search?: string; city?: string; cursor?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.city) q.set('city', params.city)
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.limit) q.set('limit', String(params.limit))
    return call<{ cabinets: CabinetDirectoryItem[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/v1/cabinets?${q}`,
      { token }
    )
  },

  getById: (id: string, token: string) =>
    call<{ cabinet: CabinetPublic }>(`/api/v1/cabinets/${id}`, { token }),

  uploadLogo: async (file: File, token: string) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/api/v1/cabinets/me/logo`, {
      method: 'POST',
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (!res.ok) throw new ApiError(json.error ?? 'Erreur upload', json.code ?? 'UNKNOWN', res.status)
    return json as ApiResponse<{ cabinet: { id: string; name: string; logoUrl: string | null } }>
  },

  deleteLogo: (token: string) =>
    call<void>('/api/v1/cabinets/me/logo', { method: 'DELETE', token }),
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
    answer: {
      id: string
      value: unknown
      status: string
      submittedAt: string | null
      expiresAt: string | null
      updatedAt: string
      document: { id: string; name: string; mimeType: string | null } | null
    } | null
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

export type SupplierCommercialContact = {
  id: string
  supplierId: string
  cabinetId: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  region: string | null
  createdAt: string
  updatedAt: string
}

export const supplierApi = {
  list: (token: string, params?: { limit?: number; cursor?: string; search?: string; category?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.search) q.set('search', params.search)
    if (params?.category) q.set('category', params.category)
    return call<{ suppliers: Supplier[]; nextCursor: string | null; hasMore: boolean; total: number }>(
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

  listProducts: (id: string, token: string) =>
    call<{ products: Product[] }>(`/api/v1/suppliers/${id}/products`, { token }),

  listCommercialContacts: (id: string, token: string) =>
    call<{ contacts: SupplierCommercialContact[] }>(`/api/v1/suppliers/${id}/commercial-contacts`, { token }),

  createCommercialContact: (id: string, data: { firstName: string; lastName: string; phone?: string; email?: string; region?: string }, token: string) =>
    call<{ contact: SupplierCommercialContact }>(`/api/v1/suppliers/${id}/commercial-contacts`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateCommercialContact: (supplierId: string, contactId: string, data: Partial<{ firstName: string; lastName: string; phone: string | null; email: string | null; region: string | null }>, token: string) =>
    call<{ contact: SupplierCommercialContact }>(`/api/v1/suppliers/${supplierId}/commercial-contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  deleteCommercialContact: (supplierId: string, contactId: string, token: string) =>
    call<void>(`/api/v1/suppliers/${supplierId}/commercial-contacts/${contactId}`, {
      method: 'DELETE',
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
  isActive: boolean
  mainCategory: 'assurance' | 'cif' | null
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
  governanceStatus: { status: 'active' | 'draft'; isDueForRevision: boolean } | null
}

export type ProductDetail = Product & {
  creator: { id: string; email: string }
  supplierLinks: Array<{ id: string; supplierId: string; supplier: { id: string; name: string } }>
}

export const productApi = {
  list: (token: string, params?: { limit?: number; cursor?: string; search?: string; mainCategory?: 'assurance' | 'cif'; category?: string; supplierId?: string; isActive?: 'true' | 'false' }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.search) q.set('search', params.search)
    if (params?.category) q.set('category', params.category)
    if (params?.mainCategory) q.set('mainCategory', params.mainCategory)
    if (params?.supplierId) q.set('supplierId', params.supplierId)
    if (params?.isActive !== undefined) q.set('isActive', params.isActive)
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

  create: (data: { name: string; description?: string; category?: string; website?: string; mainCategory?: 'assurance' | 'cif' | null }, token: string) =>
    call<{ product: Product }>('/api/v1/products', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: Partial<{ name: string; description: string; category: string; website: string; isActive: boolean; mainCategory: 'assurance' | 'cif' | null }>, token: string) =>
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

  getGovernance: (id: string, token: string) =>
    call<{ active: Governance | null; draft: Governance | null; history: Governance[] }>(
      `/api/v1/products/${id}/governance`,
      { token }
    ),

  createGovernance: (id: string, data: GovernanceInput, token: string) =>
    call<{ governance: Governance }>(`/api/v1/products/${id}/governance`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateGovernance: (id: string, govId: string, data: GovernanceInput, token: string) =>
    call<{ governance: Governance }>(`/api/v1/products/${id}/governance/${govId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  activateGovernance: (id: string, govId: string, token: string) =>
    call<{ governance: Governance }>(`/api/v1/products/${id}/governance/${govId}/activate`, {
      method: 'POST',
      token,
    }),

  reviseGovernance: (id: string, govId: string, token: string) =>
    call<{ governance: Governance }>(`/api/v1/products/${id}/governance/${govId}/revise`, {
      method: 'POST',
      token,
    }),

  deleteGovernanceDraft: (id: string, govId: string, token: string) =>
    call<unknown>(`/api/v1/products/${id}/governance/${govId}`, {
      method: 'DELETE',
      token,
    }),

  exportGovernance: (token: string) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/products/governance/export`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  dueRevisionGovernances: (token: string) =>
    call<{ items: (Governance & { product: { id: string; name: string; category: string | null } })[] }>(
      '/api/v1/products/governance/due-revision',
      { token }
    ),
}

export type MarcheCible = 'positif' | 'neutre' | 'negatif'

export type Governance = {
  id: string
  cabinetId: string
  productId: string
  clientNonProfessionnel: MarcheCible | null
  clientProfessionnel: MarcheCible | null
  connaissanceBasique: MarcheCible | null
  connaissanceInforme: MarcheCible | null
  connaissanceExpert: MarcheCible | null
  experienceFaible: MarcheCible | null
  experienceMoyenne: MarcheCible | null
  experienceElevee: MarcheCible | null
  perteAucune: MarcheCible | null
  perteLimitee: MarcheCible | null
  perteCapital: MarcheCible | null
  perteSuperieurCapital: MarcheCible | null
  risque1: MarcheCible | null
  risque23: MarcheCible | null
  risque4: MarcheCible | null
  risque56: MarcheCible | null
  risque7: MarcheCible | null
  horizonMoins2Ans: MarcheCible | null
  horizon25Ans: MarcheCible | null
  horizonPlus5Ans: MarcheCible | null
  objectifPreservation: MarcheCible | null
  objectifCroissance: MarcheCible | null
  objectifRevenus: MarcheCible | null
  objectifFiscal: MarcheCible | null
  pctTaxonomie: number | null
  pctSfdrEnvironnemental: number | null
  pctSfdrSocial: number | null
  paiGesSocietes: boolean
  paiBiodiversite: boolean
  paiEau: boolean
  paiDechets: boolean
  paiSocialPersonnel: boolean
  paiGesSouverains: boolean
  paiNormesSociales: boolean
  paiCombustiblesFossiles: boolean
  paiImmobilierEnergetique: boolean
  durabiliteCommuniquee: boolean
  producteurSoumisMif2: boolean
  marcheCibleSource: string | null
  revisionDate: string
  nextRevisionDate: string | null
  notesRevision: string | null
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

export type GovernanceInput = Partial<Omit<Governance, 'id' | 'cabinetId' | 'productId' | 'status' | 'createdAt' | 'updatedAt'>>

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

export type ToolCategory = {
  id: string
  label: string
  order: number
  isActive: boolean
  createdAt: string
}

export const toolCategoryApi = {
  list: (token: string) =>
    call<{ categories: ToolCategory[] }>('/api/v1/tools/categories', { token }),
}

export const adminToolCategoryApi = {
  list: (token: string) =>
    call<{ categories: ToolCategory[] }>('/api/v1/admin/tool-categories', { token }),

  create: (label: string, token: string) =>
    call<{ category: ToolCategory }>('/api/v1/admin/tool-categories', {
      method: 'POST',
      body: JSON.stringify({ label }),
      token,
    }),

  update: (id: string, data: { label?: string; order?: number; isActive?: boolean }, token: string) =>
    call<{ category: ToolCategory }>(`/api/v1/admin/tool-categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/admin/tool-categories/${id}`, { method: 'DELETE', token }),
}

// ── Contacts / CRM ────────────────────────────────────────────────────────────

export type ContactType = 'prospect' | 'client' | 'ancien_client'
export type MaritalStatus = 'celibataire' | 'marie' | 'pacse' | 'divorce' | 'veuf'
export type InteractionType = 'email' | 'appel' | 'rdv' | 'note'

export type Contact = {
  id: string
  firstName: string | null
  lastName: string
  email: string | null
  email2: string | null
  phone: string | null
  phone2: string | null
  type: ContactType
  birthDate: string | null
  profession: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  maritalStatus: MaritalStatus | null
  dependents: number | null
  createdAt: string
  profileStatus?: { hasProfile: boolean; isDueForReview: boolean }
}

export type ContactProfileObjectif = 'preservation' | 'croissance' | 'revenus' | 'fiscal'

export type ContactProfile = {
  id: string
  cabinetId: string
  contactId: string
  classificationMifid: 'non_professionnel' | 'professionnel' | 'contrepartie_eligible' | null
  connaissance: 'basique' | 'informe' | 'expert' | null
  experience: 'faible' | 'moyenne' | 'elevee' | null
  capacitePertes: 'aucune' | 'limitee' | 'capital' | 'superieure' | null
  sri: number | null
  horizon: 'moins_2_ans' | '2_5_ans' | 'plus_5_ans' | null
  objectifs: ContactProfileObjectif[]
  aPreferencesDurabilite: boolean
  pctTaxonomieSouhaite: number | null
  pctSfdrEnvSouhaite: number | null
  pctSfdrSocialSouhaite: number | null
  paiGesSocietes: boolean
  paiBiodiversite: boolean
  paiEau: boolean
  paiDechets: boolean
  paiSocialPersonnel: boolean
  paiGesSouverains: boolean
  paiNormesSociales: boolean
  paiCombustiblesFossiles: boolean
  paiImmobilierEnergetique: boolean
  notes: string | null
  profilDate: string
  nextReviewDate: string | null
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

export type AdequacyVerdict = 'positif' | 'neutre' | 'negatif' | 'non_evalue'

export type AdequacyResult = {
  axes: {
    type_client: { label: string; verdict: AdequacyVerdict; detail?: string }
    connaissance_experience: { label: string; verdict: AdequacyVerdict; detail?: string }
    capacite_pertes: { label: string; verdict: AdequacyVerdict; detail?: string }
    tolerance_risque: { label: string; verdict: AdequacyVerdict; detail?: string }
    objectifs: { label: string; verdict: AdequacyVerdict; detail?: string }
  }
  global: AdequacyVerdict
  is_negative_market: boolean
  is_positive_market: boolean
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
    return call<{ contacts: Contact[]; nextCursor: string | null; hasMore: boolean; total: number }>(
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

  getProfile: (contactId: string, token: string) =>
    call<{ profile: ContactProfile | null }>(`/api/v1/contacts/${contactId}/profile`, { token }),

  getProfileHistory: (contactId: string, token: string) =>
    call<{ history: ContactProfile[] }>(`/api/v1/contacts/${contactId}/profile/history`, { token }),

  saveProfile: (contactId: string, data: Partial<ContactProfile>, token: string) =>
    call<{ profile: ContactProfile }>(`/api/v1/contacts/${contactId}/profile`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateProfile: (contactId: string, profileId: string, data: Partial<ContactProfile>, token: string) =>
    call<{ profile: ContactProfile }>(`/api/v1/contacts/${contactId}/profile/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  getAdequacy: (contactId: string, token: string) =>
    call<{
      results: Array<{
        product: { id: string; name: string; category: string | null; isActive: boolean }
        governance: Record<string, unknown>
        adequacy: AdequacyResult
      }>
      hasProfile: boolean
    }>(`/api/v1/contacts/${contactId}/adequacy`, { token }),

  listProducts: (contactId: string, token: string) =>
    call<{ items: ContactProduct[] }>(`/api/v1/contacts/${contactId}/products`, { token }),

  addProduct: (contactId: string, data: { productId: string; soldAt: string; amount?: number | null; notes?: string | null }, token: string) =>
    call<{ item: ContactProduct }>(`/api/v1/contacts/${contactId}/products`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateProduct: (contactId: string, productEntryId: string, data: { soldAt?: string; amount?: number | null; notes?: string | null }, token: string) =>
    call<{ item: ContactProduct }>(`/api/v1/contacts/${contactId}/products/${productEntryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  removeProduct: (contactId: string, productEntryId: string, token: string) =>
    call<unknown>(`/api/v1/contacts/${contactId}/products/${productEntryId}`, { method: 'DELETE', token }),

  // Assets
  listAssets: (contactId: string, token: string) =>
    call<{ items: ContactAsset[] }>(`/api/v1/contacts/${contactId}/assets`, { token }),
  addAsset: (contactId: string, data: Omit<ContactAsset, 'id' | 'cabinetId' | 'contactId' | 'createdAt'>, token: string) =>
    call<{ item: ContactAsset }>(`/api/v1/contacts/${contactId}/assets`, { method: 'POST', body: JSON.stringify(data), token }),
  updateAsset: (contactId: string, assetId: string, data: Partial<Omit<ContactAsset, 'id' | 'cabinetId' | 'contactId' | 'createdAt'>>, token: string) =>
    call<{ item: ContactAsset }>(`/api/v1/contacts/${contactId}/assets/${assetId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
  removeAsset: (contactId: string, assetId: string, token: string) =>
    call<unknown>(`/api/v1/contacts/${contactId}/assets/${assetId}`, { method: 'DELETE', token }),

  // Liabilities
  listLiabilities: (contactId: string, token: string) =>
    call<{ items: ContactLiability[] }>(`/api/v1/contacts/${contactId}/liabilities`, { token }),
  addLiability: (contactId: string, data: Omit<ContactLiability, 'id' | 'cabinetId' | 'contactId' | 'createdAt'>, token: string) =>
    call<{ item: ContactLiability }>(`/api/v1/contacts/${contactId}/liabilities`, { method: 'POST', body: JSON.stringify(data), token }),
  updateLiability: (contactId: string, liabilityId: string, data: Partial<Omit<ContactLiability, 'id' | 'cabinetId' | 'contactId' | 'createdAt'>>, token: string) =>
    call<{ item: ContactLiability }>(`/api/v1/contacts/${contactId}/liabilities/${liabilityId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
  removeLiability: (contactId: string, liabilityId: string, token: string) =>
    call<unknown>(`/api/v1/contacts/${contactId}/liabilities/${liabilityId}`, { method: 'DELETE', token }),

  // Incomes
  listIncomes: (contactId: string, token: string) =>
    call<{ items: ContactIncome[] }>(`/api/v1/contacts/${contactId}/incomes`, { token }),
  addIncome: (contactId: string, data: Omit<ContactIncome, 'id' | 'cabinetId' | 'contactId' | 'createdAt'>, token: string) =>
    call<{ item: ContactIncome }>(`/api/v1/contacts/${contactId}/incomes`, { method: 'POST', body: JSON.stringify(data), token }),
  updateIncome: (contactId: string, incomeId: string, data: Partial<Omit<ContactIncome, 'id' | 'cabinetId' | 'contactId' | 'createdAt'>>, token: string) =>
    call<{ item: ContactIncome }>(`/api/v1/contacts/${contactId}/incomes/${incomeId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
  removeIncome: (contactId: string, incomeId: string, token: string) =>
    call<unknown>(`/api/v1/contacts/${contactId}/incomes/${incomeId}`, { method: 'DELETE', token }),

  // Tax
  getTax: (contactId: string, token: string) =>
    call<{ tax: ContactTax | null }>(`/api/v1/contacts/${contactId}/tax`, { token }),
  upsertTax: (contactId: string, data: Partial<Omit<ContactTax, 'id' | 'cabinetId' | 'contactId' | 'updatedAt'>>, token: string) =>
    call<{ tax: ContactTax }>(`/api/v1/contacts/${contactId}/tax`, { method: 'PUT', body: JSON.stringify(data), token }),
}

export type ContactProduct = {
  id: string
  cabinetId: string
  contactId: string
  productId: string
  soldAt: string
  amount: number | null
  notes: string | null
  createdAt: string
  product: { id: string; name: string; category: string | null; mainCategory: string | null }
}

export type ContactAsset = {
  id: string
  cabinetId: string
  contactId: string
  type: 'immobilier' | 'financier' | 'professionnel' | 'autre'
  label: string
  estimatedValue: number
  notes: string | null
  createdAt: string
}

export type ContactLiability = {
  id: string
  cabinetId: string
  contactId: string
  type: 'immobilier' | 'consommation' | 'professionnel' | 'autre'
  label: string
  outstandingAmount: number
  monthlyPayment: number | null
  endDate: string | null
  notes: string | null
  createdAt: string
}

export type ContactIncome = {
  id: string
  cabinetId: string
  contactId: string
  type: 'salaire' | 'foncier' | 'dividendes' | 'pension' | 'autre'
  label: string
  annualAmount: number
  notes: string | null
  createdAt: string
}

export type ContactTax = {
  id: string
  cabinetId: string
  contactId: string
  tmi: number | null
  regime: 'ir' | 'is' | null
  pfuOption: boolean
  ifi: boolean
  ifiValue: number | null
  notes: string | null
  updatedAt: string
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

export type TrainingCategory = {
  id: string
  name: string
  code: string
  order: number
  isActive: boolean
  requiredHours: number | null
  requiredHoursPeriod: number | null
}

export type TrainingCatalogEntry = {
  id: string
  name: string
  organizer: string | null
  category: string | null
  categoryId: string | null
  trainingCategory: { id: string; name: string; code: string } | null
  defaultHours: number | null
  isVerified: boolean
  createdBy: string
}

export type TrainingCategoryHours = {
  id: string
  trainingRecordId: string
  categoryId: string
  hours: number
  category: { id: string; name: string; code: string }
}

export type CollaboratorTraining = {
  id: string
  cabinetId: string
  userId: string | null
  memberId: string | null
  trainingId: string
  trainingDate: string
  trainingDateEnd: string | null
  hoursCompleted: number | null
  certificateDocumentId: string | null
  certificate?: { id: string; name: string; mimeType: string | null } | null
  notes: string | null
  training: TrainingCatalogEntry
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null
  member: { id: string; externalFirstName: string | null; externalLastName: string | null; externalEmail: string | null } | null
  categoryHours: TrainingCategoryHours[]
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

  create: (data: { userId?: string; memberId?: string; trainingId: string; trainingDate: string; trainingDateEnd?: string; hoursCompleted?: number; categoryHours?: { categoryId: string; hours: number }[]; certificateDocumentId?: string; notes?: string }, token: string) =>
    call<{ training: CollaboratorTraining }>('/api/v1/trainings', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: { trainingDate?: string; trainingDateEnd?: string | null; hoursCompleted?: number | null; categoryHours?: { categoryId: string; hours: number }[]; certificateDocumentId?: string | null; notes?: string | null }, token: string) =>
    call<{ training: CollaboratorTraining }>(`/api/v1/trainings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/trainings/${id}`, { method: 'DELETE', token }),

  listCategories: (token: string) =>
    call<{ categories: TrainingCategory[] }>('/api/v1/trainings/categories', { token }),
}

export const adminTrainingCategoryApi = {
  list: (token: string) =>
    call<{ categories: TrainingCategory[] }>('/api/v1/admin/training-categories', { token }),
  create: (data: { name: string; code: string; requiredHours?: number; requiredHoursPeriod?: number }, token: string) =>
    call<{ category: TrainingCategory }>('/api/v1/admin/training-categories', { method: 'POST', body: JSON.stringify(data), token }),
  update: (id: string, data: { name?: string; code?: string; order?: number; isActive?: boolean; requiredHours?: number | null; requiredHoursPeriod?: number | null }, token: string) =>
    call<{ category: TrainingCategory }>(`/api/v1/admin/training-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
  remove: (id: string, token: string) =>
    call<unknown>(`/api/v1/admin/training-categories/${id}`, { method: 'DELETE', token }),
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
  resolvedTraining?: CollaboratorTraining | null
}

export type ShareViewLog = {
  id: string
  shareId: string
  viewedAt: string
  ipAddress: string | null
  viewer: { id: string; email: string }
}

export type ShareWithViewLog = Share & {
  recipientUser: { id: string; email: string; globalRole: string }
  viewLogs: ShareViewLog[]
}

export const shareApi = {
  listGranted: (token: string, params?: { entityType?: string }) => {
    const q = new URLSearchParams()
    if (params?.entityType) q.set('entityType', params.entityType)
    const qs = q.toString()
    return call<{ shares: Share[] }>(`/api/v1/shares${qs ? `?${qs}` : ''}`, { token })
  },

  listReceived: (token: string) =>
    call<{ shares: Share[] }>('/api/v1/shares/received', { token }),

  viewsSummary: (token: string) =>
    call<{ shares: ShareWithViewLog[] }>('/api/v1/shares/views/summary', { token }),

  recordView: (shareId: string, token: string) =>
    call<unknown>(`/api/v1/shares/${shareId}/view`, { method: 'POST', token }),

  create: (data: { grantedTo: string; entityType: string; entityId?: string }, token: string) =>
    call<{ share: Share }>('/api/v1/shares', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  revoke: (id: string, token: string) =>
    call<unknown>(`/api/v1/shares/${id}`, { method: 'DELETE', token }),
}

// ── Partage conformité ────────────────────────────────────────────────────────

export type ComplianceShareItem = {
  shareId: string
  item: { id: string; label: string; type: string; phase: { label: string } }
  answer: { value: unknown; status: string; submittedAt: string | null; expiresAt: string | null; document?: { id: string; name: string } | null } | null
  status: string
}

export type ComplianceShareCabinet = {
  cabinet: { id: string; name: string; oriasNumber: string | null }
  items: ComplianceShareItem[]
}

export type ComplianceShareRecord = {
  id: string
  cabinetId: string
  grantedTo: string
  entityId: string | null
  createdAt: string
  isActive: boolean
  recipientUser: { id: string; email: string; globalRole: string }
  item: { id: string; label: string; phase: { label: string } } | null
}

export const complianceShareApi = {
  // Cabinet : partager des items
  create: (data: { itemIds: string[]; recipientIds: string[] }, token: string) =>
    call<{ created: number; skipped: number }>('/api/v1/compliance/shares', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  // Cabinet : liste des partages accordés
  list: (token: string) =>
    call<{ shares: ComplianceShareRecord[] }>('/api/v1/compliance/shares', { token }),

  // Cabinet : révoquer
  revoke: (id: string, token: string) =>
    call<unknown>(`/api/v1/compliance/shares/${id}`, { method: 'DELETE', token }),

  // Chamber/regulator : items partagés avec moi
  sharedWithMe: (token: string) =>
    call<{ cabinets: ComplianceShareCabinet[] }>('/api/v1/compliance/shared-with-me', { token }),
}

// ── Recherche d'utilisateurs (chambers / regulateurs) ────────────────────────

export type PlatformUser = {
  id: string
  email: string
  globalRole: string
  firstName?: string | null
  lastName?: string | null
  isActive?: boolean
  createdAt?: string
}

export const platformUserApi = {
  search: (query: string, token: string) => {
    const q = new URLSearchParams({ q: query, roles: 'chamber,regulator,platform_admin' })
    return call<{ users: PlatformUser[] }>(`/api/v1/users/search?${q}`, { token })
  },
}

export type ProductSubcategory = {
  id: string
  mainCategory: 'assurance' | 'cif'
  label: string
  order: number
  isActive: boolean
  createdAt: string
}

export const productSubcategoryApi = {
  list: (token: string, mainCategory?: 'assurance' | 'cif') => {
    const q = new URLSearchParams()
    if (mainCategory) q.set('mainCategory', mainCategory)
    return call<{ subcategories: ProductSubcategory[] }>(`/api/v1/products/subcategories?${q}`, { token })
  },
}

export const adminProductSubcategoryApi = {
  list: (token: string) =>
    call<{ subcategories: ProductSubcategory[] }>('/api/v1/admin/product-subcategories', { token }),

  create: (data: { mainCategory: 'assurance' | 'cif'; label: string }, token: string) =>
    call<{ subcategory: ProductSubcategory }>('/api/v1/admin/product-subcategories', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: { label?: string; order?: number; isActive?: boolean }, token: string) =>
    call<{ subcategory: ProductSubcategory }>(`/api/v1/admin/product-subcategories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  delete: (id: string, token: string) =>
    call<void>(`/api/v1/admin/product-subcategories/${id}`, { method: 'DELETE', token }),
}

export type GovernanceAxisConfig = {
  id: string
  mainCategory: 'assurance' | 'cif'
  axisId: string
  label: string
  description: string
  criteria: Array<{ field: string; label: string; sublabel?: string }>
  isEnabled: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export const governanceAxesApi = {
  list: (token: string, mainCategory?: 'assurance' | 'cif') => {
    const q = new URLSearchParams()
    if (mainCategory) q.set('mainCategory', mainCategory)
    return call<{ axes: GovernanceAxisConfig[] }>(`/api/v1/products/governance-axes?${q}`, { token })
  },
}

export const adminGovernanceAxesApi = {
  list: (token: string) =>
    call<{ axes: GovernanceAxisConfig[] }>('/api/v1/admin/governance-axes', { token }),

  update: (id: string, data: {
    label?: string
    description?: string
    criteria?: Array<{ field: string; label: string; sublabel?: string }>
    isEnabled?: boolean
    order?: number
  }, token: string) =>
    call<{ axis: GovernanceAxisConfig }>(`/api/v1/admin/governance-axes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),
}

export const adminApi = {
  listPlatformUsers: (token: string, params?: { role?: string; search?: string }) => {
    const q = new URLSearchParams()
    if (params?.role) q.set('role', params.role)
    if (params?.search) q.set('search', params.search)
    const qs = q.toString()
    return call<{ users: PlatformUser[] }>(`/api/v1/admin/platform-users${qs ? `?${qs}` : ''}`, { token })
  },

  invitePlatformUser: (
    data: { email: string; firstName: string; lastName: string; globalRole: string },
    token: string
  ) =>
    call<{ user: PlatformUser; inviteUrl: string | null }>('/api/v1/admin/platform-users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updatePlatformUser: (id: string, data: { globalRole?: string; isActive?: boolean }, token: string) =>
    call<{ user: PlatformUser }>(`/api/v1/admin/platform-users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  deletePlatformUser: (id: string, token: string) =>
    call<unknown>(`/api/v1/admin/platform-users/${id}`, { method: 'DELETE', token }),

  getSupplierLinks: (userId: string, token: string) =>
    call<{ links: { id: string; supplier: { id: string; name: string; category: string | null } }[] }>(
      `/api/v1/admin/supplier-users/${userId}`, { token }
    ),

  linkSupplierUser: (data: { userId: string; supplierId: string }, token: string) =>
    call<{ link: { id: string; supplier: { id: string; name: string } } }>('/api/v1/admin/supplier-users', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  unlinkSupplierUser: (data: { userId: string; supplierId: string }, token: string) =>
    call<unknown>('/api/v1/admin/supplier-users', {
      method: 'DELETE',
      body: JSON.stringify(data),
      token,
    }),
}

// ── Supplier portal ──────────────────────────────────────────────────────────

export type SupplierReview = {
  id: string
  supplierId: string
  cabinetId: string
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
  cabinet: { id: string; name: string }
}

export type SupplierPortalEntry = {
  id: string
  name: string
  description: string | null
  category: string | null
  website: string | null
  email: string | null
  phone: string | null
  isVerified: boolean
  createdAt: string
}

export const supplierPortalApi = {
  getMySuppliers: (token: string) =>
    call<{ suppliers: SupplierPortalEntry[] }>('/api/v1/supplier-portal/me', { token }),

  getSupplier: (id: string, token: string) =>
    call<{ supplier: SupplierPortalEntry }>(`/api/v1/supplier-portal/${id}`, { token }),

  createSupplier: (data: { name: string; description?: string; category?: string; website?: string; email?: string; phone?: string }, token: string) =>
    call<{ supplier: SupplierPortalEntry }>('/api/v1/supplier-portal', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateSupplier: (id: string, data: Partial<{ name: string; description: string | null; category: string | null; website: string | null; email: string | null; phone: string | null }>, token: string) =>
    call<{ supplier: SupplierPortalEntry }>(`/api/v1/supplier-portal/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  uploadDocument: async (supplierId: string, file: File, token: string) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/api/v1/supplier-portal/${supplierId}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const json = await res.json()
    if (!res.ok) throw new ApiError(json.error ?? 'Erreur upload', json.code ?? 'UPLOAD_ERROR', res.status)
    return json as { data: { document: Document } }
  },

  listReviews: (supplierId: string, token: string) =>
    call<{ reviews: SupplierReview[] }>(`/api/v1/supplier-portal/${supplierId}/reviews`, { token }),

  listDocuments: (supplierId: string, token: string) =>
    call<{ documents: Document[] }>(`/api/v1/supplier-portal/${supplierId}/documents`, { token }),

  getDocumentUrl: (supplierId: string, docId: string, token: string) =>
    call<{ url: string; expiresIn: number | null }>(`/api/v1/supplier-portal/${supplierId}/documents/${docId}/url`, { token }),

  deleteDocument: (supplierId: string, docId: string, token: string) =>
    call<void>(`/api/v1/supplier-portal/${supplierId}/documents/${docId}`, { method: 'DELETE', token }),

  toggleDocumentPublic: (supplierId: string, docId: string, isPublic: boolean, token: string) =>
    call<{ document: Document }>(`/api/v1/supplier-portal/${supplierId}/documents/${docId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublic }),
      token,
    }),
}

export const supplierPublicApi = {
  listDocuments: (supplierId: string, token: string) =>
    call<{ documents: Document[] }>(`/api/v1/suppliers/${supplierId}/documents`, { token }),

  getDocumentUrl: (supplierId: string, docId: string, token: string) =>
    call<{ url: string; expiresIn: number | null }>(`/api/v1/suppliers/${supplierId}/documents/${docId}/url`, { token }),
}

// ── Types conformité fournisseur ───────────────────────────────────────────────

export type ChecklistItemState = {
  key: string
  label: string
  description: string
  verification_url?: string
  requires_document: boolean
  allows_online_verification: boolean
  completed: boolean
  mode: 'document' | 'online' | 'na' | null
  document_id: string | null
  verified_url: string | null
}

export type SupplierVerification = {
  id: string
  cabinetId: string
  supplierId: string
  supplierType: string
  checklist: ChecklistItemState[]
  beneficiairesVerifies: boolean
  beneficiairesSource: string | null
  verificationDate: string | null
  verifiedBy: string | null
  decision: 'approved' | 'rejected' | 'pending' | null
  decisionNote: string | null
  createdAt: string
  updatedAt: string
}

export type EvaluationNote = {
  critere_id: 'solvabilite' | 'reputation' | 'moyens' | 'relation' | 'remuneration'
  note: number
  commentaire?: string
}

export type SupplierEvaluation = {
  id: string
  cabinetId: string
  supplierId: string
  evaluationNotes: EvaluationNote[]
  scoreGlobal: number | null
  evaluationDate: string
  nextReviewDate: string | null
  evaluateurIds: string[]
  contratSigneLe: string | null
  contratDuree: string | null
  contratPreavis: string | null
  contratDocumentId: string | null
  status: 'draft' | 'completed'
  createdAt: string
  updatedAt: string
}

export const supplierComplianceApi = {
  getVerification: (supplierId: string, token: string) =>
    call<{ verification: SupplierVerification | null }>(`/api/v1/suppliers/${supplierId}/verification`, { token }),

  upsertVerification: (supplierId: string, data: object, token: string) =>
    call<{ verification: SupplierVerification }>(`/api/v1/suppliers/${supplierId}/verification`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  decide: (supplierId: string, data: { decision: string; decisionNote?: string | null; verificationDate?: string }, token: string) =>
    call<{ verification: SupplierVerification }>(`/api/v1/suppliers/${supplierId}/verification/decide`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  listEvaluations: (supplierId: string, token: string) =>
    call<{ evaluations: SupplierEvaluation[] }>(`/api/v1/suppliers/${supplierId}/evaluations`, { token }),

  createEvaluation: (supplierId: string, data: object, token: string) =>
    call<{ evaluation: SupplierEvaluation }>(`/api/v1/suppliers/${supplierId}/evaluations`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateEvaluation: (supplierId: string, evalId: string, data: object, token: string) =>
    call<{ evaluation: SupplierEvaluation }>(`/api/v1/suppliers/${supplierId}/evaluations/${evalId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  completeEvaluation: (supplierId: string, evalId: string, token: string) =>
    call<{ evaluation: SupplierEvaluation }>(`/api/v1/suppliers/${supplierId}/evaluations/${evalId}/complete`, {
      method: 'POST',
      token,
    }),

  getDueReviews: (token: string) =>
    call<{ evaluations: (SupplierEvaluation & { supplier: { id: string; name: string; category: string | null } })[] }>(
      '/api/v1/suppliers/evaluations/due-review',
      { token }
    ),
}

// ── Cabinet (paramètres) ───────────────────────────────────────────────────────

export type CabinetMember = {
  id: string
  cabinetId: string
  userId: string | null
  role: 'owner' | 'admin' | 'member'
  canManageSuppliers: boolean
  canManageProducts: boolean
  canManageContacts: boolean
  isPublic: boolean
  externalFirstName: string | null
  externalLastName: string | null
  externalEmail: string | null
  externalTitle: string | null
  createdAt: string
  user: { id: string; email: string; civility?: 'M.' | 'Mme' | null; firstName?: string | null; lastName?: string | null; globalRole: string } | null
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
    call<{ member: CabinetMember; inviteUrl: string | null }>('/api/v1/cabinets/me/members/invite', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (memberId: string, data: { role?: 'admin' | 'member'; canManageSuppliers?: boolean; canManageProducts?: boolean; canManageContacts?: boolean; isPublic?: boolean; externalFirstName?: string; externalLastName?: string; externalEmail?: string; externalTitle?: string }, token: string) =>
    call<{ member: CabinetMember }>(`/api/v1/cabinets/me/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  remove: (memberId: string, token: string) =>
    call<unknown>(`/api/v1/cabinets/me/members/${memberId}`, { method: 'DELETE', token }),

  addExternal: (data: { firstName: string; lastName: string; email?: string; title?: string; isPublic?: boolean }, token: string) =>
    call<{ member: CabinetMember }>('/api/v1/cabinets/me/members/external', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
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

export type Tag = {
  id: string
  cabinetId: string | null
  name: string
  color: string | null
  isSystem: boolean
}

export type Folder = {
  id: string
  cabinetId: string
  name: string
  parentId: string | null
  isSystem: boolean
  order: number
  createdAt: string
}

export type ExportJob = {
  id: string
  cabinetId: string
  requestedBy: string
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'EXPIRED'
  storagePath: string | null
  expiresAt: string | null
  error: string | null
  createdAt: string
  completedAt: string | null
}

export type Document = {
  id: string
  name: string
  description: string | null
  isPublic?: boolean
  storageMode: 'hosted' | 'external'
  mimeType: string | null
  sizeBytes: string | null
  folderId: string | null
  createdAt: string
  links: DocumentLink[]
  tags?: { tag: Tag }[]
}

export type DocumentLink = {
  id: string
  documentId: string
  entityType: string
  entityId: string
  label: string | null
}

export const documentApi = {
  list: (token: string, params?: { limit?: number; cursor?: string; entityType?: string; entityId?: string; folderId?: string; tagId?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.entityType) q.set('entityType', params.entityType)
    if (params?.entityId) q.set('entityId', params.entityId)
    if (params?.folderId !== undefined) q.set('folderId', params.folderId)
    if (params?.tagId) q.set('tagId', params.tagId)
    return call<{ documents: Document[]; nextCursor: string | null; hasMore: boolean; total: number }>(
      `/api/v1/documents?${q}`,
      { token }
    )
  },

  get: (id: string, token: string) =>
    call<{ document: Document }>(`/api/v1/documents/${id}`, { token }),

  getUrl: (id: string, token: string) =>
    call<{ url: string; expiresIn: number | null }>(`/api/v1/documents/${id}/url`, { token }),

  getSharedUrl: (id: string, token: string) =>
    call<{ url: string; expiresIn: number | null }>(`/api/v1/documents/${id}/shared-url`, { token }),

  upload: async (file: File, token: string, entityType?: string) => {
    const form = new FormData()
    form.append('file', file)
    const q = entityType ? `?entityType=${encodeURIComponent(entityType)}` : ''
    const res = await fetch(`${API_URL}/api/v1/documents/upload${q}`, {
      method: 'POST',
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (!res.ok) throw new ApiError(json.error ?? 'Erreur API', json.code ?? 'UNKNOWN', res.status)
    return json as { data: { document: Document } }
  },

  patch: (id: string, data: { name?: string; description?: string | null; folderId?: string | null }, token: string) =>
    call<{ document: Document }>(`/api/v1/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/documents/${id}`, { method: 'DELETE', token }),

  rename: (id: string, name: string, token: string) =>
    call<{ document: Document }>(`/api/v1/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
      token,
    }),

  addTag: (documentId: string, tagId: string, token: string) =>
    call<{ documentTag: unknown }>(`/api/v1/documents/${documentId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagId }),
      token,
    }),

  removeTag: (documentId: string, tagId: string, token: string) =>
    call<unknown>(`/api/v1/documents/${documentId}/tags/${tagId}`, { method: 'DELETE', token }),

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

export type FolderRuleEntityType = 'contact' | 'supplier' | 'product' | 'training' | 'compliance_answer'

export const FOLDER_RULE_LABELS: Record<FolderRuleEntityType, string> = {
  contact: 'CRM / Contacts',
  supplier: 'Fournisseurs',
  product: 'Produits',
  training: 'Formations (certificats)',
  compliance_answer: 'Conformité',
}

export type FolderRule = {
  id: string
  cabinetId: string
  entityType: FolderRuleEntityType
  folderId: string
  folder: { id: string; name: string; parentId: string | null; isSystem: boolean }
}

export const folderRulesApi = {
  list: (token: string) =>
    call<{ rules: FolderRule[] }>('/api/v1/folder-rules', { token }),

  upsert: (data: { entityType: FolderRuleEntityType; folderId: string }, token: string) =>
    call<{ rule: FolderRule }>('/api/v1/folder-rules', {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  delete: (entityType: FolderRuleEntityType, token: string) =>
    call<unknown>(`/api/v1/folder-rules/${entityType}`, { method: 'DELETE', token }),
}

export const folderApi = {
  list: (token: string) =>
    call<{ folders: Folder[] }>('/api/v1/folders', { token }),

  create: (data: { name: string; parentId?: string; order?: number }, token: string) =>
    call<{ folder: Folder }>('/api/v1/folders', { method: 'POST', body: JSON.stringify(data), token }),

  update: (id: string, data: { name?: string; parentId?: string | null; order?: number }, token: string) =>
    call<{ folder: Folder }>(`/api/v1/folders/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/folders/${id}`, { method: 'DELETE', token }),
}

export const tagApi = {
  list: (token: string) =>
    call<{ tags: Tag[] }>('/api/v1/tags', { token }),

  create: (data: { name: string; color?: string }, token: string) =>
    call<{ tag: Tag }>('/api/v1/tags', { method: 'POST', body: JSON.stringify(data), token }),

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/tags/${id}`, { method: 'DELETE', token }),
}

export const exportJobApi = {
  create: (token: string) =>
    call<{ job: ExportJob }>('/api/v1/exports/jobs', { method: 'POST', body: '{}', token }),

  list: (token: string) =>
    call<{ jobs: ExportJob[] }>('/api/v1/exports/jobs', { token }),

  get: (id: string, token: string) =>
    call<{ job: ExportJob; downloadUrl: string | null }>(`/api/v1/exports/jobs/${id}`, { token }),
}

// ── Agenda ────────────────────────────────────────────────────────────────────

export type EventType = 'RDV' | 'CALL' | 'TASK' | 'COMPLIANCE'
export type EventStatus = 'PLANNED' | 'DONE' | 'CANCELLED'

export type CalendarEvent = {
  id: string
  cabinetId: string
  createdBy: string
  contactId: string | null
  title: string
  description: string | null
  type: EventType
  status: EventStatus
  startAt: string
  endAt: string
  allDay: boolean
  location: string | null
  complianceAnswerId: string | null
  isRecurring: boolean
  recurrenceRule: string | null
  createdAt: string
  updatedAt: string
  contact: { id: string; firstName: string | null; lastName: string; type: string } | null
}

export const eventApi = {
  list: (token: string, params?: { start?: string; end?: string; type?: string }) => {
    const q = new URLSearchParams()
    if (params?.start) q.set('start', params.start)
    if (params?.end) q.set('end', params.end)
    if (params?.type) q.set('type', params.type)
    return call<{ events: CalendarEvent[] }>(`/api/v1/events?${q}`, { token })
  },

  upcoming: (token: string) =>
    call<{ events: CalendarEvent[] }>('/api/v1/events/upcoming', { token }),

  create: (data: {
    title: string; type: 'RDV' | 'CALL' | 'TASK'; startAt: string; endAt: string
    contactId?: string | null; description?: string | null; location?: string | null
    allDay?: boolean; isRecurring?: boolean; recurrenceRule?: string | null
    status?: EventStatus
  }, token: string) =>
    call<{ event: CalendarEvent }>('/api/v1/events', {
      method: 'POST', body: JSON.stringify(data), token,
    }),

  update: (id: string, data: Partial<{
    title: string; type: 'RDV' | 'CALL' | 'TASK'; startAt: string; endAt: string
    contactId: string | null; description: string | null; location: string | null
    allDay: boolean; isRecurring: boolean; recurrenceRule: string | null; status: EventStatus
  }>, token: string) =>
    call<{ event: CalendarEvent }>(`/api/v1/events/${id}`, {
      method: 'PATCH', body: JSON.stringify(data), token,
    }),

  updateStatus: (id: string, status: EventStatus, token: string) =>
    call<{ event: CalendarEvent }>(`/api/v1/events/${id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }), token,
    }),

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/events/${id}`, { method: 'DELETE', token }),

  getIcsUrl: (cabinetId: string, icsToken: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/calendar/${cabinetId}/feed.ics?token=${icsToken}`,

  regenerateToken: (token: string) =>
    call<{ icsToken: string }>('/api/v1/calendar/regenerate-token', {
      method: 'POST', body: JSON.stringify({}), token,
    }),
}

// ── Clusters ──────────────────────────────────────────────────────────────────

export type ClusterRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type ChannelType = 'ASYNC' | 'REALTIME'

export type Cluster = {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  isVerified: boolean
  avatarUrl: string | null
  createdAt: string
  createdBy: string
  creator: { id: string; firstName: string | null; lastName: string | null; email: string }
  _count: { members: number; channels: number }
  isMember: boolean
}

export type ClusterDetail = Cluster & {
  channels: Channel[]
  role: ClusterRole | null
}

export type Channel = {
  id: string
  clusterId: string
  name: string
  type: ChannelType
  isPrivate: boolean
  createdAt: string
  lastMessageAt: string | null
}

export type ClusterMessage = {
  id: string
  channelId: string
  authorUserId: string
  authorCabinetId: string
  content: string
  parentId: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  authorUser: { id: string; firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null }
  authorCabinet: { id: string; name: string }
  reactions: { emoji: string; userId: string; cabinetId: string }[]
  _count: { replies: number }
}

export const channelApi = {
  get: (channelId: string, token: string) =>
    call<{ channel: Channel & { clusterId: string } }>(`/api/v1/channels/${channelId}`, { token }),
}

export const clusterApi = {
  list: (token: string, params?: { search?: string; cursor?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.limit) q.set('limit', String(params.limit))
    return call<{ clusters: Cluster[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/v1/clusters?${q}`, { token }
    )
  },

  get: (id: string, token: string) =>
    call<{ cluster: ClusterDetail }>(`/api/v1/clusters/${id}`, { token }),

  create: (data: { name: string; description?: string; isPublic?: boolean; avatarUrl?: string }, token: string) =>
    call<{ cluster: { id: string; name: string } }>('/api/v1/clusters', {
      method: 'POST', body: JSON.stringify(data), token,
    }),

  update: (id: string, data: Partial<{ name: string; description: string; isPublic: boolean; avatarUrl: string }>, token: string) =>
    call<{ cluster: Cluster }>(`/api/v1/clusters/${id}`, {
      method: 'PATCH', body: JSON.stringify(data), token,
    }),

  delete: (id: string, token: string) =>
    call<unknown>(`/api/v1/clusters/${id}`, { method: 'DELETE', token }),

  join: (id: string, token: string) =>
    call<{ role: ClusterRole }>(`/api/v1/clusters/${id}/join`, { method: 'POST', body: '{}', token }),

  leave: (id: string, token: string) =>
    call<unknown>(`/api/v1/clusters/${id}/leave`, { method: 'POST', body: '{}', token }),

  createChannel: (id: string, data: { name: string; type: ChannelType; isPrivate?: boolean }, token: string) =>
    call<{ channel: Channel }>(`/api/v1/clusters/${id}/channels`, {
      method: 'POST', body: JSON.stringify(data), token,
    }),

  updateChannel: (clusterId: string, channelId: string, data: Partial<{ name: string; isPrivate: boolean }>, token: string) =>
    call<{ channel: Channel }>(`/api/v1/clusters/${clusterId}/channels/${channelId}`, {
      method: 'PATCH', body: JSON.stringify(data), token,
    }),

  deleteChannel: (clusterId: string, channelId: string, token: string) =>
    call<unknown>(`/api/v1/clusters/${clusterId}/channels/${channelId}`, { method: 'DELETE', token }),
}

export const messageApi = {
  list: (channelId: string, token: string, params?: { parentId?: string; cursor?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.parentId) q.set('parentId', params.parentId)
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.limit) q.set('limit', String(params.limit))
    return call<{ messages: ClusterMessage[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/v1/channels/${channelId}/messages?${q}`, { token }
    )
  },

  create: (channelId: string, data: { content: string; parentId?: string }, token: string) =>
    call<{ message: ClusterMessage }>(`/api/v1/channels/${channelId}/messages`, {
      method: 'POST', body: JSON.stringify(data), token,
    }),

  update: (messageId: string, content: string, token: string) =>
    call<{ message: ClusterMessage }>(`/api/v1/messages/${messageId}`, {
      method: 'PATCH', body: JSON.stringify({ content }), token,
    }),

  delete: (messageId: string, token: string) =>
    call<unknown>(`/api/v1/messages/${messageId}`, { method: 'DELETE', token }),

  react: (messageId: string, emoji: string, token: string) =>
    call<{ action: 'added' | 'removed'; emoji: string }>(`/api/v1/messages/${messageId}/reactions`, {
      method: 'POST', body: JSON.stringify({ emoji }), token,
    }),

  report: (messageId: string, reason: string, token: string) =>
    call<{ report: unknown }>(`/api/v1/messages/${messageId}/report`, {
      method: 'POST', body: JSON.stringify({ reason }), token,
    }),
}

export type MessageReport = {
  id: string
  reason: string
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED'
  createdAt: string
  reporter: { id: string; firstName: string | null; lastName: string | null; email: string }
  message: {
    id: string
    content: string
    deletedAt: string | null
    createdAt: string
    authorUser: { id: string; firstName: string | null; lastName: string | null; email: string }
    authorCabinet: { id: string; name: string }
    channel: { id: string; name: string; cluster: { id: string; name: string } }
  }
}

export const adminClusterApi = {
  listReports: (token: string, status?: string) => {
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    return call<{ reports: MessageReport[] }>(`/api/v1/admin/reports?${q}`, { token })
  },

  updateReport: (id: string, status: 'REVIEWED' | 'DISMISSED', token: string) =>
    call<{ status: string }>(`/api/v1/admin/reports/${id}`, {
      method: 'PATCH', body: JSON.stringify({ status }), token,
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

// ── Consentement ──────────────────────────────────────────────────────────────

export type ConsentRecord = {
  id: string
  userId: string
  version: string
  acceptedAt: string
  ipAddress: string | null
  userAgent: string | null
}

export const consentApi = {
  accept: (version: string, token: string) =>
    call<ConsentRecord>('/api/v1/consent', {
      method: 'POST',
      body: JSON.stringify({ version }),
      token,
    }),

  list: (token: string) =>
    call<ConsentRecord[]>('/api/v1/consent', { token }),
}

// ── RGPD ──────────────────────────────────────────────────────────────────────

export type GdprRequest = {
  id: string
  type: 'ACCESS' | 'ERASURE'
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'REJECTED'
  message: string | null
  response: string | null
  exportPath: string | null
  createdAt: string
  processedAt: string | null
  requester?: { id: string; firstName: string | null; lastName: string | null; email: string }
  cabinet?: { id: string; name: string }
  processor?: { id: string; firstName: string | null; lastName: string | null; email: string } | null
}

export const gdprApi = {
  createRequest: (type: 'ACCESS' | 'ERASURE', message: string | undefined, token: string) =>
    call<GdprRequest>('/api/v1/gdpr/requests', {
      method: 'POST',
      body: JSON.stringify({ type, message }),
      token,
    }),

  listRequests: (token: string) =>
    call<GdprRequest[]>('/api/v1/gdpr/requests', { token }),
}

export const adminGdprApi = {
  listRequests: (token: string, status?: string) => {
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    return call<GdprRequest[]>(`/api/v1/admin/gdpr/requests?${q}`, { token })
  },

  updateRequest: (id: string, status: 'PROCESSING' | 'DONE' | 'REJECTED', response: string | undefined, token: string) =>
    call<GdprRequest>(`/api/v1/admin/gdpr/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, response }),
      token,
    }),
}

// ── PCA ───────────────────────────────────────────────────────────────────────

export type PcaData = Record<string, unknown>

export type PcaHistoryEntry = {
  id: string
  createdAt: string
  savedBy: string
  data: Record<string, { old: unknown; new: unknown }>
  user: { id: string; firstName: string | null; lastName: string | null; email: string }
}

export type CabinetPca = {
  id: string
  cabinetId: string
  data: PcaData
  isCompleted: boolean
  completedAt: string | null
  updatedAt: string
  createdAt: string
}

export const pcaApi = {
  get: (token: string) =>
    call<{ pca: CabinetPca }>('/api/v1/pca', { token }),

  save: (data: PcaData, token: string) =>
    call<{ pca: CabinetPca }>('/api/v1/pca', {
      method: 'PUT',
      body: JSON.stringify({ data }),
      token,
    }),

  setCompleted: (completed: boolean, token: string) =>
    call<{ pca: CabinetPca }>('/api/v1/pca/complete', {
      method: 'POST',
      body: JSON.stringify({ completed }),
      token,
    }),

  history: (token: string) =>
    call<{ history: PcaHistoryEntry[] }>('/api/v1/pca/history', { token }),

  historyEntry: (id: string, token: string) =>
    call<{ entry: { id: string; data: PcaData; createdAt: string; user: { firstName: string | null; lastName: string | null; email: string } } }>(`/api/v1/pca/history/${id}`, { token }),
}
