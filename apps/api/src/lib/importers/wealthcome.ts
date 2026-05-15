import { ParsedContact, ParseResult } from './types'
import { parseFileToRows, normalizeDate, col } from './utils'

// Colonnes export Wealthcome — à ajuster selon le format réel
export function parseWealthcome(buffer: Buffer, filename: string): ParseResult {
  try {
    const rows = parseFileToRows(buffer, filename)
    if (!rows.length) return { ok: false, error: 'Fichier vide ou non lisible' }

    const contacts: ParsedContact[] = []

    for (const row of rows) {
      const firstName = col(row, 'Prénom', 'prenom', 'firstname', 'PRENOM')
      const lastName = col(row, 'Nom', 'nom', 'lastname', 'NOM', 'Nom client')

      if (!lastName && !firstName) continue

      const statusRaw = col(row, 'Statut', 'Type client', 'Segment')?.toLowerCase() ?? ''
      const type: ParsedContact['type'] =
        statusRaw.includes('prospect') ? 'prospect'
        : statusRaw.includes('ancien') ? 'ancien_client'
        : 'client'

      contacts.push({
        firstName: firstName ?? '',
        lastName: lastName ?? '',
        email: col(row, 'Email', 'email', 'E-mail', 'Adresse email'),
        phone: col(row, 'Téléphone', 'Mobile', 'telephone', 'Tél portable', 'Tél fixe'),
        birthDate: normalizeDate(col(row, 'Date de naissance', 'Naissance', 'date_naissance') ?? ''),
        address: col(row, 'Adresse', 'adresse', 'Adresse postale'),
        city: col(row, 'Ville', 'ville', 'Localité'),
        postalCode: col(row, 'Code postal', 'CP', 'code_postal'),
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
