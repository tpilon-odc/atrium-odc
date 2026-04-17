import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { prisma } from './prisma'
import { minioNative, BUCKET, buildStoragePath, uploadToMinio } from './minio'

export interface TemplateVariable {
  label: string
  fieldKey: string
  placeholder: string
}

// Résout les valeurs des champs selon l'entité cible
export async function resolveVariableValues(
  fieldKeys: string[],
  opts: {
    contactId?: string
    cabinetId: string
    generatedByUserId: string
  }
): Promise<Record<string, string>> {
  const values: Record<string, string> = {}

  // Champs système toujours disponibles
  const today = new Date()
  const todayStr = today.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // Contact
  let contact: {
    firstName: string | null
    lastName: string
    email: string | null
    email2: string | null
    phone: string | null
    phone2: string | null
    birthDate: Date | null
    profession: string | null
    address: string | null
    city: string | null
    postalCode: string | null
    country: string | null
    maritalStatus: string | null
    dependents: number | null
  } | null = null

  if (opts.contactId) {
    contact = await prisma.contact.findUnique({
      where: { id: opts.contactId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        email2: true,
        phone: true,
        phone2: true,
        birthDate: true,
        profession: true,
        address: true,
        city: true,
        postalCode: true,
        country: true,
        maritalStatus: true,
        dependents: true,
      },
    })
  }

  // Cabinet
  const cabinet = await prisma.cabinet.findUnique({
    where: { id: opts.cabinetId },
    select: {
      name: true, siret: true, oriasNumber: true, city: true, website: true,
      adresse: true, codePostal: true, formeJuridique: true, capitalSocial: true,
      dateImmatriculation: true, categoriesOrias: true, oriasValiditeJusquau: true, dateAdhesionCncgp: true,
    },
  })

  // Conseiller (utilisateur qui génère)
  const conseiller = await prisma.user.findUnique({
    where: { id: opts.generatedByUserId },
    select: { firstName: true, lastName: true, email: true },
  })

  const maritalStatusLabels: Record<string, string> = {
    celibataire: 'Célibataire',
    marie: 'Marié(e)',
    pacse: 'Pacsé(e)',
    divorce: 'Divorcé(e)',
    veuf: 'Veuf/Veuve',
  }

  const fieldMap: Record<string, () => string> = {
    // Contact
    contact_prenom: () => contact?.firstName ?? '',
    contact_nom: () => contact?.lastName ?? '',
    contact_nom_complet: () => [contact?.firstName, contact?.lastName].filter(Boolean).join(' '),
    contact_email: () => contact?.email ?? '',
    contact_email2: () => contact?.email2 ?? '',
    contact_telephone: () => contact?.phone ?? '',
    contact_telephone2: () => contact?.phone2 ?? '',
    contact_date_naissance: () =>
      contact?.birthDate
        ? new Date(contact.birthDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '',
    contact_profession: () => contact?.profession ?? '',
    contact_adresse: () => contact?.address ?? '',
    contact_ville: () => contact?.city ?? '',
    contact_code_postal: () => contact?.postalCode ?? '',
    contact_pays: () => contact?.country ?? '',
    contact_situation_maritale: () =>
      contact?.maritalStatus ? (maritalStatusLabels[contact.maritalStatus] ?? contact.maritalStatus) : '',
    contact_personnes_a_charge: () =>
      contact?.dependents != null ? String(contact.dependents) : '',

    // Cabinet
    cabinet_nom: () => cabinet?.name ?? '',
    cabinet_siret: () => cabinet?.siret ?? '',
    cabinet_orias: () => cabinet?.oriasNumber ?? '',
    cabinet_ville: () => cabinet?.city ?? '',
    cabinet_adresse: () => cabinet?.adresse ?? '',
    cabinet_code_postal: () => cabinet?.codePostal ?? '',
    cabinet_adresse_complete: () => [cabinet?.adresse, cabinet?.codePostal && cabinet?.city ? `${cabinet.codePostal} ${cabinet.city}` : cabinet?.city].filter(Boolean).join(', '),
    cabinet_site_web: () => cabinet?.website ?? '',
    cabinet_forme_juridique: () => cabinet?.formeJuridique ?? '',
    cabinet_capital_social: () => cabinet?.capitalSocial ?? '',
    cabinet_date_immatriculation: () => cabinet?.dateImmatriculation ? new Date(cabinet.dateImmatriculation).toLocaleDateString('fr-FR') : '',
    cabinet_categories_orias: () => cabinet?.categoriesOrias?.join(', ') ?? '',
    cabinet_orias_validite: () => cabinet?.oriasValiditeJusquau ? new Date(cabinet.oriasValiditeJusquau).toLocaleDateString('fr-FR') : '',
    cabinet_date_adhesion_cncgp: () => cabinet?.dateAdhesionCncgp ? new Date(cabinet.dateAdhesionCncgp).toLocaleDateString('fr-FR') : '',

    // Conseiller
    conseiller_prenom: () => conseiller?.firstName ?? '',
    conseiller_nom: () => conseiller?.lastName ?? '',
    conseiller_nom_complet: () => [conseiller?.firstName, conseiller?.lastName].filter(Boolean).join(' '),
    conseiller_email: () => conseiller?.email ?? '',

    // Système
    date_aujourd_hui: () => todayStr,
    annee_en_cours: () => String(today.getFullYear()),
  }

  // Séparer les champs compliance_item_<id> des champs standards
  const complianceItemIds = fieldKeys
    .filter((k) => k.startsWith('compliance_item_'))
    .map((k) => k.replace('compliance_item_', ''))

  // Résoudre les réponses conformité du cabinet en une seule requête
  let complianceValues: Record<string, string> = {}
  if (complianceItemIds.length > 0) {
    const answers = await prisma.cabinetComplianceAnswer.findMany({
      where: {
        cabinetId: opts.cabinetId,
        itemId: { in: complianceItemIds },
        deletedAt: null,
      },
      select: {
        itemId: true,
        value: true,
        status: true,
        submittedAt: true,
        expiresAt: true,
        item: { select: { type: true } },
      },
    })

    for (const answer of answers) {
      const key = `compliance_item_${answer.itemId}`
      const val = answer.value as Record<string, unknown>

      let resolved = ''
      switch (answer.item.type) {
        case 'text':
          resolved = typeof val.text === 'string' ? val.text : ''
          break
        case 'radio':
          resolved = Array.isArray(val.selected) ? String(val.selected[0] ?? '') : ''
          break
        case 'checkbox':
          resolved = Array.isArray(val.selected) ? val.selected.join(', ') : ''
          break
        case 'doc':
          // Pour les documents, on indique juste le statut (le document lui-même n'est pas du texte)
          resolved = answer.status === 'submitted' ? 'Document fourni' : 'Document manquant'
          break
      }
      complianceValues[key] = resolved
    }

    // Pour les items sans réponse, retourner une chaîne vide
    for (const itemId of complianceItemIds) {
      const key = `compliance_item_${itemId}`
      if (!(key in complianceValues)) complianceValues[key] = ''
    }
  }

  for (const key of fieldKeys) {
    if (key.startsWith('compliance_item_')) {
      values[key] = complianceValues[key] ?? ''
    } else {
      values[key] = fieldMap[key]?.() ?? ''
    }
  }

  return values
}

// Télécharge le .docx depuis MinIO, fusionne les variables, retourne le buffer résultat
export async function mergeDocxTemplate(
  fileKey: string,
  variables: TemplateVariable[],
  resolvedValues: Record<string, string>
): Promise<Buffer> {
  // Récupérer le fichier depuis MinIO
  const stream = await minioNative.getObject(BUCKET, fileKey)
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', resolve)
    stream.on('error', reject)
  })
  const docxBuffer = Buffer.concat(chunks)

  // Lire le contenu du .docx
  const zip = new PizZip(docxBuffer)
  let content = zip.file('word/document.xml')?.asText()
  if (!content) throw new Error('Fichier .docx invalide ou corrompu')

  // Remplacer chaque placeholder par sa valeur
  for (const variable of variables) {
    const value = resolvedValues[variable.fieldKey] ?? ''
    // Escape les caractères XML dans la valeur
    const safeValue = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

    // Le placeholder peut être fragmenté dans le XML — on remplace aussi la version brute
    const escapedPlaceholder = variable.placeholder
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    content = content.split(escapedPlaceholder).join(safeValue)
    content = content.split(variable.placeholder).join(safeValue)
  }

  // Remettre le XML modifié dans le zip
  zip.file('word/document.xml', content)

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

// Upload le .docx fusionné dans MinIO et retourne la clé
export async function uploadMergedDocx(cabinetId: string, buffer: Buffer, originalName: string): Promise<string> {
  const name = originalName.replace(/\.docx$/i, '') + '_genere_' + Date.now() + '.docx'
  const key = buildStoragePath(cabinetId, name)
  await uploadToMinio(
    key,
    buffer,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
  return key
}
