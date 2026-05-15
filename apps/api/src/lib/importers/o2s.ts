import * as XLSX from 'xlsx'
import { ParsedContact, ParsedAsset, ParsedIncome, ParsedProfile, ParseResult } from './types'
import { normalizeDate } from './utils'

// O2S (Harvest) — deux formats possibles :
// 1. Export masse : tableau avec colonnes techniques (client_nom, client_prenom, …), ligne 1 = libellés humains
// 2. Fiche individuelle : une feuille par contact, format vertical clé/valeur

// ── Format masse ──────────────────────────────────────────────────────────────

function isMassFormat(rows: Record<string, string>[]): boolean {
  return rows.length >= 1 && 'client_nom' in rows[0]
}

function parseMassFormat(rows: Record<string, string>[]): ParsedContact[] {
  const contacts: ParsedContact[] = []
  // Ligne 0 = libellés humains (on la saute), données à partir de la ligne 1
  const dataRows = 'client_nom' in rows[0] && rows[0].client_nom === 'WAYNE' ? rows : rows.slice(1)

  for (const row of dataRows) {
    const lastName = row.client_nom?.trim()
    const firstName = row.client_prenom?.trim()
    if (!lastName && !firstName) continue

    const typeRaw = row.type_contact?.toLowerCase() ?? ''
    const type: ParsedContact['type'] =
      typeRaw.includes('prospect') ? 'prospect'
      : typeRaw.includes('ancien') ? 'ancien_client'
      : 'client'

    // Adresse domicile en priorité
    const adresse = [row.client_domicile_adresse_ligne1, row.client_domicile_adresse_ligne2]
      .map((s) => s?.trim()).filter(Boolean).join(', ') || null

    // Date naissance : ignorer "//" (valeur vide O2S)
    const naissanceRaw = row.client_date_naissance?.trim() ?? ''
    const birthDate = naissanceRaw && naissanceRaw !== '//' ? normalizeDate(naissanceRaw) : null

    contacts.push({
      firstName: firstName ?? '',
      lastName: lastName ?? '',
      email: row.email_personnel?.trim() || row.email_professionnel?.trim() || null,
      phone: row.telephone_mobile?.trim() || row.telephone_domicile?.trim() || row.telephone_bureau?.trim() || null,
      birthDate,
      address: adresse,
      city: row.client_domicile_commune?.trim() || null,
      postalCode: row.client_domicile_cp?.trim() || null,
      country: row.client_domicile_pays?.trim() || 'France',
      type,
    })
  }
  return contacts
}

// ── Format fiche individuelle ─────────────────────────────────────────────────

function parseFicheSheet(ws: XLSX.WorkSheet, sheetName: string): ParsedContact | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]
  const dict: Record<string, string> = {}
  for (const row of rows) {
    const r = row as unknown[]
    const key = String(r[0] ?? '').replace(/\r\n/g, ' ').trim()
    const val = String(r[1] ?? '').trim()
    if (key) dict[key] = val
  }

  const sheetClean = sheetName.replace(/^(Monsieur|Madame|M\.|Mme\.?)\s+/i, '').trim()
  const parts = sheetClean.split(' ')
  const lastNameParts: string[] = []
  const firstNameParts: string[] = []
  for (const p of parts) {
    if (p === p.toUpperCase() && p.length > 1) lastNameParts.push(p)
    else firstNameParts.push(p)
  }
  const firstName = firstNameParts.join(' ').trim()
  const lastName = lastNameParts.join(' ').trim()
  if (!lastName && !firstName) return null

  const adresseRaw = dict['Adresse complète (Domicile) (adresse de correspondance)'] ?? dict['Adresse'] ?? ''
  const adresseLines = adresseRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const adresse = adresseLines[0] ?? null
  const cpVilleMatch = (adresseLines[1] ?? '').match(/^(\d{5})\s+(.+)$/)

  const naissanceRaw = dict['Date et lieu de naissance'] ?? ''
  const birthDate = normalizeDate(naissanceRaw.split(' ')[0] ?? '')

  const email = dict['Email (personnel) (email de correspondance)'] ?? dict['Email'] ?? null
  const phone = dict['Téléphone (mobile)'] ?? dict['Téléphone (fixe)'] ?? dict['Téléphone'] ?? null

  // ── Actifs patrimoniaux ───────────────────────────────────────────────────
  const ASSET_MAP: Array<{ key: string; type: string; label: string }> = [
    { key: 'Compte courant',           type: 'financier',   label: 'Compte courant' },
    { key: 'Contrat d\'assurance vie', type: 'financier',   label: 'Assurance vie' },
    { key: 'Immobilier locatif',       type: 'immobilier',  label: 'Immobilier locatif' },
    { key: 'Résidence principale',     type: 'immobilier',  label: 'Résidence principale' },
    { key: 'PEA',                      type: 'financier',   label: 'PEA' },
    { key: 'Compte titres',            type: 'financier',   label: 'Compte titres' },
    { key: 'SCPI',                     type: 'immobilier',  label: 'SCPI' },
  ]
  const assets: ParsedAsset[] = []
  for (const { key, type, label } of ASSET_MAP) {
    const raw = dict[key]?.replace(/\s/g, '').replace('€', '').replace(',', '.') ?? ''
    const val = parseFloat(raw)
    if (!isNaN(val) && val > 0) assets.push({ type, label, estimatedValue: val })
  }

  // ── Revenus ───────────────────────────────────────────────────────────────
  const incomes: ParsedIncome[] = []
  const revenusRaw = dict['Revenus annuels']?.replace(/\s/g, '').replace('€', '').replace(',', '.') ?? ''
  const revenusVal = parseFloat(revenusRaw)
  if (!isNaN(revenusVal) && revenusVal > 0) {
    incomes.push({ type: 'salaire', label: 'Revenus annuels', annualAmount: revenusVal })
  }

  // ── Profil MiFID ──────────────────────────────────────────────────────────
  // Correspondance libellés O2S → codes internes (contraintes CHECK en base)
  const CLASSIFICATION_MAP: Record<string, string> = {
    'non professionnel': 'non_professionnel',
    'professionnel': 'professionnel',
    'contrepartie éligible': 'contrepartie_eligible',
  }
  const CONNAISSANCE_MAP: Record<string, string> = {
    'basique': 'basique',
    'informé': 'informe',
    'expert': 'expert',
  }
  const CAPACITE_MAP: Record<string, string> = {
    'aucune': 'aucune',
    'limitée': 'limitee',
    'capital': 'capital',
    'très élevée': 'superieure',
    'élevée': 'superieure',
    'supérieure': 'superieure',
  }
  const HORIZON_MAP: Record<string, string> = {
    'court terme': 'moins_2_ans',
    'moins de 2 ans': 'moins_2_ans',
    'moyen terme': '2_5_ans',
    '2 à 5 ans': '2_5_ans',
    'long terme': 'plus_5_ans',
    'horizon long terme': 'plus_5_ans',
    'supérieur à 5 ans': 'plus_5_ans',
  }

  function mapVal(raw: string | undefined, map: Record<string, string>): string | null {
    if (!raw) return null
    const key = raw.toLowerCase().trim()
    for (const [k, v] of Object.entries(map)) {
      if (key.includes(k)) return v
    }
    return null
  }

  const objectifsRaw = dict['Objectifs'] ?? ''
  const objectifs = objectifsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)

  const profile: ParsedProfile = {
    classificationMifid: mapVal(dict['Classification client MIF'], CLASSIFICATION_MAP),
    connaissance: mapVal(dict['Niveau de connaissance et expérience'], CONNAISSANCE_MAP),
    capacitePertes: mapVal(dict['Capacité financière à subir des pertes'], CAPACITE_MAP),
    horizon: mapVal(dict['Horizon de placement'], HORIZON_MAP),
    objectifs,
  }
  const hasProfile = Object.values(profile).some((v) => (Array.isArray(v) ? v.length > 0 : v !== null))

  return {
    firstName,
    lastName,
    email: email || null,
    phone: phone || null,
    birthDate,
    address: adresse,
    city: cpVilleMatch?.[2] ?? null,
    postalCode: cpVilleMatch?.[1] ?? null,
    country: dict['Pays de résidence fiscale'] ?? 'France',
    type: 'client',
    ...(assets.length ? { assets } : {}),
    ...(incomes.length ? { incomes } : {}),
    ...(hasProfile ? { profile } : {}),
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

export function parseO2S(buffer: Buffer, _filename: string): ParseResult {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    if (!wb.SheetNames.length) return { ok: false, error: 'Fichier vide ou non lisible' }

    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

    let contacts: ParsedContact[]

    if (isMassFormat(rows)) {
      // Export masse : une feuille, toutes les lignes sont des contacts
      contacts = parseMassFormat(rows)
    } else {
      // Export fiches : une feuille par contact
      contacts = wb.SheetNames
        .map((name) => parseFicheSheet(wb.Sheets[name], name))
        .filter((c): c is ParsedContact => c !== null)
    }

    if (!contacts.length) return { ok: false, error: 'Aucun contact valide trouvé dans le fichier' }
    return { ok: true, contacts }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Erreur de lecture du fichier' }
  }
}
