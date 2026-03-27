// Re-export from packages/types for use in API
// This avoids cross-package import path issues
export const XLSX_COLUMN_HEADERS = [
  // Axe 1
  { field: 'clientNonProfessionnel', group: 'Type de client', label: 'Client non professionnel' },
  { field: 'clientProfessionnel', group: 'Type de client', label: 'Client professionnel / C.É.' },
  // Axe 2
  { field: 'connaissanceBasique', group: 'Connaissance & expérience', label: 'Connaissance basique' },
  { field: 'connaissanceInforme', group: 'Connaissance & expérience', label: 'Connaissance informé' },
  { field: 'connaissanceExpert', group: 'Connaissance & expérience', label: 'Connaissance expert' },
  { field: 'experienceFaible', group: 'Connaissance & expérience', label: 'Expérience faible' },
  { field: 'experienceMoyenne', group: 'Connaissance & expérience', label: 'Expérience moyenne' },
  { field: 'experienceElevee', group: 'Connaissance & expérience', label: 'Expérience élevée' },
  // Axe 3
  { field: 'perteAucune', group: 'Capacité pertes', label: 'Aucune perte' },
  { field: 'perteLimitee', group: 'Capacité pertes', label: 'Pertes limitées' },
  { field: 'perteCapital', group: 'Capacité pertes', label: 'Perte capital' },
  { field: 'perteSuperieurCapital', group: 'Capacité pertes', label: 'Pertes > capital' },
  // Axe 4
  { field: 'risque1', group: 'Tolérance risque (SRI)', label: 'SRI 1 — Très faible' },
  { field: 'risque23', group: 'Tolérance risque (SRI)', label: 'SRI 2-3 — Faible' },
  { field: 'risque4', group: 'Tolérance risque (SRI)', label: 'SRI 4 — Moyenne' },
  { field: 'risque56', group: 'Tolérance risque (SRI)', label: 'SRI 5-6 — Élevée' },
  { field: 'risque7', group: 'Tolérance risque (SRI)', label: 'SRI 7 — Très élevée' },
  // Axe 5
  { field: 'horizonMoins2Ans', group: 'Objectifs & besoins', label: 'Horizon < 2 ans' },
  { field: 'horizon25Ans', group: 'Objectifs & besoins', label: 'Horizon 2-5 ans' },
  { field: 'horizonPlus5Ans', group: 'Objectifs & besoins', label: 'Horizon > 5 ans' },
  { field: 'objectifPreservation', group: 'Objectifs & besoins', label: 'Préservation capital' },
  { field: 'objectifCroissance', group: 'Objectifs & besoins', label: 'Croissance capital' },
  { field: 'objectifRevenus', group: 'Objectifs & besoins', label: 'Revenus complémentaires' },
  { field: 'objectifFiscal', group: 'Objectifs & besoins', label: 'Avantage fiscal' },
  // Durabilité
  { field: 'pctTaxonomie', group: 'Durabilité', label: '% Taxonomie env.' },
  { field: 'pctSfdrEnvironnemental', group: 'Durabilité', label: '% SFDR environnemental' },
  { field: 'pctSfdrSocial', group: 'Durabilité', label: '% SFDR social' },
] as const
