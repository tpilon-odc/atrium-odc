import * as XLSX from 'xlsx'
import { ParsedContact, ParseResult } from './types'
import { normalizeDate } from './utils'

// Format O2S (Harvest) : fiche verticale, une feuille par contact
// Colonne A = libellé, colonne B = valeur
// Le nom de la feuille contient la civilité + prénom + nom (ex: "Monsieur Bruce WAYNE")

function parseSheet(ws: XLSX.WorkSheet, sheetName: string): ParsedContact | null {
  // Construire un dictionnaire libellé → valeur depuis les paires A/B
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]
  const dict: Record<string, string> = {}
  for (const row of rows) {
    const r = row as unknown[]
    const key = String(r[0] ?? '').replace(/\r\n/g, ' ').trim()
    const val = String(r[1] ?? '').trim()
    if (key) dict[key] = val
  }

  // Extraire prénom/nom depuis le nom de la feuille (ex: "Monsieur Bruce WAYNE")
  // Format : [Civilité] [Prénom(s)] [NOM EN MAJUSCULES]
  let firstName = ''
  let lastName = ''
  const sheetClean = sheetName.replace(/^(Monsieur|Madame|M\.|Mme\.?)\s+/i, '').trim()
  // Le nom de famille est en majuscules, le prénom en mixed case
  const parts = sheetClean.split(' ')
  const lastNameParts: string[] = []
  const firstNameParts: string[] = []
  for (const p of parts) {
    if (p === p.toUpperCase() && p.length > 1) lastNameParts.push(p)
    else firstNameParts.push(p)
  }
  firstName = firstNameParts.join(' ').trim()
  lastName = lastNameParts.join(' ').trim()

  if (!lastName && !firstName) return null

  // Adresse : peut contenir des retours à la ligne (rue\nCP VILLE\nPays)
  const adresseRaw = dict['Adresse complète (Domicile)\r\n(adresse de correspondance)']
    ?? dict['Adresse complète (Domicile) (adresse de correspondance)']
    ?? dict['Adresse']
    ?? ''
  const adresseLines = adresseRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const adresse = adresseLines[0] ?? null
  // Ligne 2 : "80440 BOVES" → CP + ville
  const cpVille = adresseLines[1] ?? ''
  const cpVilleMatch = cpVille.match(/^(\d{5})\s+(.+)$/)
  const postalCode = cpVilleMatch?.[1] ?? null
  const city = cpVilleMatch?.[2] ?? (cpVille || null)

  // Date de naissance : "14/05/1975 à BOVES (80440)" → on prend juste la date
  const naissanceRaw = dict['Date et lieu de naissance'] ?? ''
  const birthDate = normalizeDate(naissanceRaw.split(' ')[0] ?? '')

  const email = dict['Email (personnel)\r\n(email de correspondance)']
    ?? dict['Email (personnel) (email de correspondance)']
    ?? dict['Email']
    ?? null

  const phone = dict['Téléphone (mobile)']
    ?? dict['Téléphone (fixe)']
    ?? dict['Téléphone']
    ?? null

  return {
    firstName,
    lastName,
    email: email || null,
    phone: phone || null,
    birthDate,
    address: adresse,
    city,
    postalCode,
    country: dict['Pays de résidence fiscale'] ?? 'France',
    type: 'client',
  }
}

export function parseO2S(buffer: Buffer, _filename: string): ParseResult {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    if (!wb.SheetNames.length) return { ok: false, error: 'Fichier vide ou non lisible' }

    const contacts: ParsedContact[] = []

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const contact = parseSheet(ws, sheetName)
      if (contact) contacts.push(contact)
    }

    if (!contacts.length) return { ok: false, error: 'Aucun contact valide trouvé dans le fichier' }
    return { ok: true, contacts }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Erreur de lecture du fichier' }
  }
}
