import { ParsedContact, ParseResult } from './types'
import { parseFileToRows, normalizeDate, col } from './utils'

// Colonnes export O2S (Harvest) — à ajuster selon le format réel
// Noms courants observés dans les exports O2S clients
export function parseO2S(buffer: Buffer, filename: string): ParseResult {
  try {
    const rows = parseFileToRows(buffer, filename)
    if (!rows.length) return { ok: false, error: 'Fichier vide ou non lisible' }

    const contacts: ParsedContact[] = []

    for (const row of rows) {
      const firstName = col(row, 'Prénom', 'prenom', 'PRENOM', 'First Name')
      const lastName = col(row, 'Nom', 'nom', 'NOM', 'Last Name', 'Nom de famille')

      // Ignorer les lignes sans nom
      if (!lastName && !firstName) continue

      const statusRaw = col(row, 'Statut', 'statut', 'Type client', 'Type')?.toLowerCase() ?? ''
      const type: ParsedContact['type'] =
        statusRaw.includes('prospect') ? 'prospect'
        : statusRaw.includes('ancien') ? 'ancien_client'
        : 'client'

      contacts.push({
        firstName: firstName ?? '',
        lastName: lastName ?? '',
        email: col(row, 'Email', 'email', 'E-mail', 'Adresse email', 'Mail'),
        phone: col(row, 'Téléphone', 'telephone', 'Tel', 'Mobile', 'Tél. mobile', 'Tél. fixe'),
        birthDate: normalizeDate(col(row, 'Date de naissance', 'Naissance', 'DateNaissance') ?? ''),
        address: col(row, 'Adresse', 'adresse', 'Rue'),
        city: col(row, 'Ville', 'ville', 'Commune'),
        postalCode: col(row, 'Code postal', 'CP', 'CodePostal', 'code_postal'),
        country: col(row, 'Pays', 'pays') ?? 'France',
        type,
      })
    }

    if (!contacts.length) return { ok: false, error: 'Aucun contact valide trouvé dans le fichier' }
    return { ok: true, contacts }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Erreur de lecture du fichier' }
  }
}
