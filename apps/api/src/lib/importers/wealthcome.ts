import * as XLSX from 'xlsx'
import { ParsedContact, ParseResult } from './types'
import { normalizeDate } from './utils'

// Format Wealthcome : tableau, colonnes en français, une ligne par contact
// La date de naissance est un numéro de série Excel (ex: 24544)
// Le téléphone peut être un nombre (pas de zéro leading)

function parseDate(val: unknown): string | null {
  if (!val) return null
  // Numéro de série Excel
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    return null
  }
  return normalizeDate(String(val).trim())
}

function parsePhone(val: unknown): string | null {
  if (!val) return null
  const s = String(val).trim().replace(/\s/g, '')
  if (!s) return null
  // Remettre le zéro leading si numéro FR à 9 chiffres
  if (/^\d{9}$/.test(s)) return '0' + s
  return s
}

export function parseWealthcome(buffer: Buffer, _filename: string): ParseResult {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    if (!wb.SheetNames.length) return { ok: false, error: 'Fichier vide ou non lisible' }

    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    if (!rows.length) return { ok: false, error: 'Fichier vide ou non lisible' }

    const contacts: ParsedContact[] = []

    for (const row of rows) {
      const lastName = String(row['Nom'] ?? '').trim()
      const firstName = String(row['Prénom'] ?? '').trim()
      if (!lastName && !firstName) continue

      const typeRaw = String(row['Type de client'] ?? '').toLowerCase()
      const type: ParsedContact['type'] =
        typeRaw.includes('prospect') ? 'prospect'
        : typeRaw.includes('ancien') ? 'ancien_client'
        : 'client'

      const cpRaw = row['Code postal']
      const postalCode = cpRaw ? String(cpRaw).trim().padStart(5, '0') : null

      contacts.push({
        firstName,
        lastName,
        email: String(row['Adresse mail'] ?? '').trim() || null,
        phone: parsePhone(row['Téléphone']),
        birthDate: parseDate(row['Date de naissance']),
        address: String(row['Adresse'] ?? '').trim() || null,
        city: String(row['Ville'] ?? '').trim() || null,
        postalCode,
        country: String(row['Pays'] ?? '').trim() || 'France',
        type,
      })
    }

    if (!contacts.length) return { ok: false, error: 'Aucun contact valide trouvé dans le fichier' }
    return { ok: true, contacts }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Erreur de lecture du fichier' }
  }
}
