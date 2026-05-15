import { ParsedContact, ParseResult } from './types'
import { parseFileToRows, normalizeDate, col } from './utils'

// Colonnes export Quantalys — à ajuster selon le format réel
export function parseQuantalys(buffer: Buffer, filename: string): ParseResult {
  try {
    const rows = parseFileToRows(buffer, filename)
    if (!rows.length) return { ok: false, error: 'Fichier vide ou non lisible' }

    const contacts: ParsedContact[] = []

    for (const row of rows) {
      const firstName = col(row, 'Prénom', 'prenom', 'PRENOM', 'FirstName')
      const lastName = col(row, 'Nom', 'nom', 'NOM', 'LastName', 'Nom du client')

      if (!lastName && !firstName) continue

      const statusRaw = col(row, 'Statut', 'Type', 'Catégorie')?.toLowerCase() ?? ''
      const type: ParsedContact['type'] =
        statusRaw.includes('prospect') ? 'prospect'
        : statusRaw.includes('ancien') ? 'ancien_client'
        : 'client'

      contacts.push({
        firstName: firstName ?? '',
        lastName: lastName ?? '',
        email: col(row, 'Email', 'E-mail', 'Courriel', 'email'),
        phone: col(row, 'Téléphone', 'Mobile', 'Tél', 'telephone'),
        birthDate: normalizeDate(col(row, 'Date naissance', 'DateNaissance', 'Naissance') ?? ''),
        address: col(row, 'Adresse', 'Rue', 'adresse'),
        city: col(row, 'Ville', 'ville', 'Commune'),
        postalCode: col(row, 'Code postal', 'CP', 'CodePostal'),
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
