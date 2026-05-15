export type ParsedAsset = {
  type: string   // immobilier | financier | autre
  label: string
  estimatedValue: number
}

export type ParsedIncome = {
  type: string   // salaire | foncier | dividendes | pension | autre
  label: string
  annualAmount: number
}

export type ParsedProfile = {
  classificationMifid: string | null
  connaissance: string | null
  capacitePertes: string | null
  horizon: string | null
  objectifs: string[]
}

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
  // Données enrichies (optionnelles selon l'outil)
  assets?: ParsedAsset[]
  incomes?: ParsedIncome[]
  profile?: ParsedProfile
}

export type ImportToolSlug = 'O2S' | 'QUANTALYS' | 'WEALTHCOME'

export type ParseResult =
  | { ok: true; contacts: ParsedContact[] }
  | { ok: false; error: string }
