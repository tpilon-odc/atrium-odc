export type ChecklistItemKey =
  | 'kbis' | 'rne' | 'beneficiaires_effectifs' | 'agrement_amf'
  | 'agrement_acpr' | 'agrement_esma' | 'enregistrement_psan'
  | 'enregistrement_ibd' | 'attestation_orias' | 'piece_identite_dirigeant'
  | 'pouvoir_representant' | 'piece_identite_representant'
  | 'statuts_certifies' | 'rc_pro' | 'inscription_prefecture'

export interface ChecklistItem {
  key: ChecklistItemKey
  label: string
  description: string
  verification_url?: string
  requires_document: boolean
  allows_online_verification: boolean
}

export const SUPPLIER_TYPES = [
  { value: 'sgp',                  label: 'Société de Gestion de Portefeuille (SGP)' },
  { value: 'psi',                  label: 'Prestataire de Services d\'Investissement (PSI)' },
  { value: 'psfp',                 label: 'Prestataire Services Financement Participatif (PSFP)' },
  { value: 'psan',                 label: 'Prestataire Services sur Actifs Numériques (PSAN)' },
  { value: 'biens_divers',         label: 'Intermédiaire en Biens Divers' },
  { value: 'cif_plateforme',       label: 'Distributeur / Plateforme CIF' },
  { value: 'promoteur_non_regule', label: 'Promoteur non régulé' },
] as const

export type SupplierTypeValue = typeof SUPPLIER_TYPES[number]['value']

export const CHECKLIST_BY_TYPE: Record<SupplierTypeValue, ChecklistItem[]> = {
  sgp: [
    {
      key: 'kbis',
      label: 'Extrait Kbis de moins de 3 mois',
      description: 'Ou justificatif d\'immatriculation RNE depuis l\'Annuaire des Entreprises',
      verification_url: 'https://annuaire-entreprises.data.gouv.fr/',
      requires_document: true,
      allows_online_verification: true,
    },
    {
      key: 'beneficiaires_effectifs',
      label: 'Identité des bénéficiaires effectifs',
      description: 'Demander le document ou vérifier dans le Registre des Bénéficiaires Effectifs',
      verification_url: 'https://data.inpi.fr/',
      requires_document: false,
      allows_online_verification: true,
    },
    {
      key: 'agrement_amf',
      label: 'Justificatif d\'agrément AMF',
      description: 'Pour les SGP françaises. Ou Passeport européen pour les gestionnaires étrangers',
      verification_url: 'https://geco.amf-france.org/accueil',
      requires_document: false,
      allows_online_verification: true,
    },
  ],
  psi: [
    { key: 'kbis', label: 'Extrait Kbis de moins de 3 mois', description: 'Ou justificatif RNE', verification_url: 'https://annuaire-entreprises.data.gouv.fr/', requires_document: true, allows_online_verification: true },
    { key: 'beneficiaires_effectifs', label: 'Identité des bénéficiaires effectifs', description: 'Document ou vérification RBE', verification_url: 'https://data.inpi.fr/', requires_document: false, allows_online_verification: true },
    { key: 'agrement_acpr', label: 'Justificatif d\'agrément ACPR', description: 'Pour les PSI français. Ou Passeport européen pour les établissements étrangers', verification_url: 'https://www.regafi.fr/spip.php?rubrique1', requires_document: false, allows_online_verification: true },
  ],
  psfp: [
    { key: 'kbis', label: 'Extrait Kbis de moins de 3 mois', description: 'Ou justificatif RNE', verification_url: 'https://annuaire-entreprises.data.gouv.fr/', requires_document: true, allows_online_verification: true },
    { key: 'beneficiaires_effectifs', label: 'Identité des bénéficiaires effectifs', description: 'Document ou vérification RBE', verification_url: 'https://data.inpi.fr/', requires_document: false, allows_online_verification: true },
    { key: 'agrement_esma', label: 'Justificatif d\'agrément ESMA ou AMF', description: 'Registre ESMA (ECSP) ou liste blanche AMF', verification_url: 'https://registers.esma.europa.eu/publication/searchRegister?core=esma_registers_upreg', requires_document: false, allows_online_verification: true },
  ],
  psan: [
    { key: 'kbis', label: 'Extrait Kbis de moins de 3 mois', description: 'Ou justificatif RNE', verification_url: 'https://annuaire-entreprises.data.gouv.fr/', requires_document: true, allows_online_verification: true },
    { key: 'beneficiaires_effectifs', label: 'Identité des bénéficiaires effectifs', description: 'Document ou vérification RBE', verification_url: 'https://data.inpi.fr/', requires_document: false, allows_online_verification: true },
    { key: 'enregistrement_psan', label: 'Enregistrement ou agrément AMF PSAN', description: 'Liste blanche des PSAN sur data.gouv.fr ou AMF', verification_url: 'https://www.amf-france.org/fr/espace-epargnants/proteger-son-epargne/listes-blanches', requires_document: false, allows_online_verification: true },
  ],
  biens_divers: [
    { key: 'kbis', label: 'Extrait Kbis de moins de 3 mois', description: 'Ou justificatif RNE', verification_url: 'https://annuaire-entreprises.data.gouv.fr/', requires_document: true, allows_online_verification: true },
    { key: 'piece_identite_dirigeant', label: 'Pièce d\'identité du dirigeant en cours de validité', description: 'Copie de la pièce d\'identité', requires_document: true, allows_online_verification: false },
    { key: 'beneficiaires_effectifs', label: 'Identité des bénéficiaires effectifs', description: 'Document ou vérification RBE', verification_url: 'https://data.inpi.fr/', requires_document: false, allows_online_verification: true },
    { key: 'enregistrement_ibd', label: 'Numéro d\'enregistrement AMF (biens divers)', description: 'Vérifier sur la liste blanche AMF', verification_url: 'https://www.amf-france.org/fr/espace-epargnants/proteger-son-epargne/listes-blanches', requires_document: false, allows_online_verification: true },
  ],
  cif_plateforme: [
    { key: 'kbis', label: 'Extrait Kbis de moins de 3 mois', description: 'Ou justificatif RNE', verification_url: 'https://annuaire-entreprises.data.gouv.fr/', requires_document: true, allows_online_verification: true },
    { key: 'piece_identite_dirigeant', label: 'Pièce d\'identité du dirigeant en cours de validité', description: 'Copie de la pièce d\'identité', requires_document: true, allows_online_verification: false },
    { key: 'beneficiaires_effectifs', label: 'Identité des bénéficiaires effectifs', description: 'Document ou vérification RBE', verification_url: 'https://data.inpi.fr/', requires_document: false, allows_online_verification: true },
    { key: 'attestation_orias', label: 'Attestation ORIAS de moins de 3 mois', description: 'Justifiant de l\'immatriculation comme CIF', verification_url: 'https://www.orias.fr/', requires_document: true, allows_online_verification: true },
  ],
  promoteur_non_regule: [
    { key: 'kbis', label: 'Extrait Kbis de moins de 3 mois et statuts certifiés conformes', description: 'Les deux documents sont requis', requires_document: true, allows_online_verification: false },
    { key: 'statuts_certifies', label: 'Statuts certifiés conformes', description: '', requires_document: true, allows_online_verification: false },
    { key: 'piece_identite_dirigeant', label: 'Pièce d\'identité du dirigeant en cours de validité', description: '', requires_document: true, allows_online_verification: false },
    { key: 'beneficiaires_effectifs', label: 'Identité des bénéficiaires effectifs (ET vérification RBE obligatoire)', description: 'Les deux sont obligatoires pour les promoteurs non régulés', verification_url: 'https://data.inpi.fr/', requires_document: true, allows_online_verification: true },
    { key: 'rc_pro', label: 'Attestation d\'assurance responsabilité civile professionnelle', description: '', requires_document: true, allows_online_verification: false },
  ],
}

export interface ChecklistItemState extends ChecklistItem {
  completed: boolean
  mode: 'document' | 'online' | 'na' | null  // null = non renseigné
  document_id: string | null
  verified_url: string | null
}

export function initChecklist(supplierType: SupplierTypeValue): ChecklistItemState[] {
  return (CHECKLIST_BY_TYPE[supplierType] ?? []).map((item) => ({
    ...item,
    completed: false,
    mode: null,
    document_id: null,
    verified_url: null,
  }))
}
