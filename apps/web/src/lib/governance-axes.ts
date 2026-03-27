export type MarcheCibleValue = 'positif' | 'neutre' | 'negatif'

export const MARCHE_CIBLE_LABELS: Record<MarcheCibleValue, string> = {
  positif: 'Positif',
  neutre: 'Neutre',
  negatif: 'Négatif',
}

export interface GovernanceCriterion {
  field: string
  label: string
  sublabel?: string
}

export interface GovernanceAxis {
  id: string
  label: string
  description: string
  criteria: GovernanceCriterion[]
}

export const GOVERNANCE_AXES: GovernanceAxis[] = [
  {
    id: 'type_client',
    label: '1. Type de client',
    description: 'Catégorie de client au sens MiFID II à qui le produit est destiné.',
    criteria: [
      { field: 'clientNonProfessionnel', label: 'Client non professionnel' },
      { field: 'clientProfessionnel', label: 'Client professionnel ou contrepartie éligible' },
    ],
  },
  {
    id: 'connaissance_experience',
    label: '2. Connaissance et expérience',
    description: "Niveau de connaissance et d'expérience des produits financiers que doivent avoir les clients ciblés.",
    criteria: [
      { field: 'connaissanceBasique', label: 'Connaissance', sublabel: 'Basique' },
      { field: 'connaissanceInforme', label: 'Connaissance', sublabel: 'Informé' },
      { field: 'connaissanceExpert', label: 'Connaissance', sublabel: 'Expert' },
      { field: 'experienceFaible', label: 'Expérience', sublabel: 'Faible' },
      { field: 'experienceMoyenne', label: 'Expérience', sublabel: 'Moyenne' },
      { field: 'experienceElevee', label: 'Expérience', sublabel: 'Élevée' },
    ],
  },
  {
    id: 'capacite_pertes',
    label: '3. Capacité à supporter des pertes',
    description: 'Montant des pertes que les clients ciblés peuvent supporter.',
    criteria: [
      { field: 'perteAucune', label: 'Aucune perte en capital' },
      { field: 'perteLimitee', label: 'Pertes en capital limitées' },
      { field: 'perteCapital', label: 'Perte du capital investi' },
      { field: 'perteSuperieurCapital', label: 'Pertes supérieures au capital investi' },
    ],
  },
  {
    id: 'tolerance_risque',
    label: '4. Tolérance au risque',
    description: "Attitude vis-à-vis du risque, classée par indicateur SRI (issu du DIC PRIIPS).",
    criteria: [
      { field: 'risque1', label: 'Très faible', sublabel: 'Indicateur de risque : 1' },
      { field: 'risque23', label: 'Faible', sublabel: 'Indicateur de risque : 2 à 3' },
      { field: 'risque4', label: 'Moyenne', sublabel: 'Indicateur de risque : 4' },
      { field: 'risque56', label: 'Élevée', sublabel: 'Indicateur de risque : 5 à 6' },
      { field: 'risque7', label: 'Très élevée', sublabel: 'Indicateur de risque : 7' },
    ],
  },
  {
    id: 'objectifs_besoins',
    label: '5. Objectifs et besoins',
    description: "Horizon de placement et objectifs d'investissement des clients ciblés.",
    criteria: [
      { field: 'horizonMoins2Ans', label: 'Horizon de placement', sublabel: 'Inférieur à 2 ans' },
      { field: 'horizon25Ans', label: 'Horizon de placement', sublabel: 'Entre 2 et 5 ans' },
      { field: 'horizonPlus5Ans', label: 'Horizon de placement', sublabel: 'Supérieur à 5 ans' },
      { field: 'objectifPreservation', label: 'Objectif', sublabel: 'Préservation du capital' },
      { field: 'objectifCroissance', label: 'Objectif', sublabel: 'Croissance du capital' },
      { field: 'objectifRevenus', label: 'Objectif', sublabel: 'Revenus complémentaires' },
      { field: 'objectifFiscal', label: 'Objectif', sublabel: 'Avantage fiscal' },
    ],
  },
]

export const ALL_MARCHE_CIBLE_FIELDS = GOVERNANCE_AXES.flatMap((a) => a.criteria.map((c) => c.field))
