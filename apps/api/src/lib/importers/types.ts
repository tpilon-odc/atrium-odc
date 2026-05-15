export type ParsedContact = {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  birthDate: string | null   // ISO YYYY-MM-DD
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  type: 'prospect' | 'client' | 'ancien_client'
}

export type ImportToolSlug = 'O2S' | 'QUANTALYS' | 'WEALTHCOME'

export type ParseResult =
  | { ok: true; contacts: ParsedContact[] }
  | { ok: false; error: string }
