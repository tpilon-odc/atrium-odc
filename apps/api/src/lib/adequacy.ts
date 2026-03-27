// ── Moteur d'adéquation MiFID II ──────────────────────────────────────────────
// Fonction pure : compare le profil client aux marchés cibles d'un produit.
// Ne fait aucun appel DB — testable unitairement.

export type AdequacyVerdict = 'positif' | 'neutre' | 'negatif' | 'non_evalue'

export interface AxisResult {
  label: string
  verdict: AdequacyVerdict
  detail?: string
}

export interface AdequacyResult {
  axes: {
    type_client: AxisResult
    connaissance_experience: AxisResult
    capacite_pertes: AxisResult
    tolerance_risque: AxisResult
    objectifs: AxisResult
  }
  global: AdequacyVerdict
  is_negative_market: boolean
  is_positive_market: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GovernanceRow = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProfileRow = Record<string, any>

function getSriField(sri: number): string {
  if (sri === 1) return 'risque1'
  if (sri <= 3) return 'risque23'
  if (sri === 4) return 'risque4'
  if (sri <= 6) return 'risque56'
  return 'risque7'
}

function getHorizonField(horizon: string): string | null {
  const map: Record<string, string> = {
    moins_2_ans: 'horizonMoins2Ans',
    '2_5_ans': 'horizon25Ans',
    plus_5_ans: 'horizonPlus5Ans',
  }
  return map[horizon] ?? null
}

function getObjectifField(objectif: string): string | null {
  const map: Record<string, string> = {
    preservation: 'objectifPreservation',
    croissance: 'objectifCroissance',
    revenus: 'objectifRevenus',
    fiscal: 'objectifFiscal',
  }
  return map[objectif] ?? null
}

function worstVerdict(a: AdequacyVerdict, b: AdequacyVerdict): AdequacyVerdict {
  if (a === 'negatif' || b === 'negatif') return 'negatif'
  if (a === 'neutre' || b === 'neutre') return 'neutre'
  if (a === 'positif' || b === 'positif') return 'positif'
  return 'non_evalue'
}

function govVal(gov: GovernanceRow, field: string): AdequacyVerdict {
  const v = gov[field]
  if (v === 'positif' || v === 'neutre' || v === 'negatif') return v
  return 'non_evalue'
}

export function computeAdequacy(profile: ProfileRow, governance: GovernanceRow): AdequacyResult {
  // ── Axe 1 : Type de client ─────────────────────────────────────────────────
  let typeClientVerdict: AdequacyVerdict = 'non_evalue'
  if (profile.classificationMifid) {
    const fieldMap: Record<string, string> = {
      non_professionnel: 'clientNonProfessionnel',
      professionnel: 'clientProfessionnel',
      contrepartie_eligible: 'clientProfessionnel',
    }
    const field = fieldMap[profile.classificationMifid]
    if (field) typeClientVerdict = govVal(governance, field)
  }

  // ── Axe 2 : Connaissance & expérience ─────────────────────────────────────
  let connaissanceVerdict: AdequacyVerdict = 'non_evalue'
  if (profile.connaissance) {
    const fieldMap: Record<string, string> = {
      basique: 'connaissanceBasique',
      informe: 'connaissanceInforme',
      expert: 'connaissanceExpert',
    }
    connaissanceVerdict = govVal(governance, fieldMap[profile.connaissance])
  }
  let experienceVerdict: AdequacyVerdict = 'non_evalue'
  if (profile.experience) {
    const fieldMap: Record<string, string> = {
      faible: 'experienceFaible',
      moyenne: 'experienceMoyenne',
      elevee: 'experienceElevee',
    }
    experienceVerdict = govVal(governance, fieldMap[profile.experience])
  }
  const connaissanceExperienceVerdict = worstVerdict(connaissanceVerdict, experienceVerdict)

  // ── Axe 3 : Capacité à supporter des pertes ────────────────────────────────
  let capaciteVerdict: AdequacyVerdict = 'non_evalue'
  if (profile.capacitePertes) {
    const fieldMap: Record<string, string> = {
      aucune: 'perteAucune',
      limitee: 'perteLimitee',
      capital: 'perteCapital',
      superieure: 'perteSuperieurCapital',
    }
    capaciteVerdict = govVal(governance, fieldMap[profile.capacitePertes])
  }

  // ── Axe 4 : Tolérance au risque (SRI) ─────────────────────────────────────
  let risqueVerdict: AdequacyVerdict = 'non_evalue'
  if (profile.sri) {
    risqueVerdict = govVal(governance, getSriField(profile.sri))
  }

  // ── Axe 5 : Objectifs et besoins ──────────────────────────────────────────
  let horizonVerdict: AdequacyVerdict = 'non_evalue'
  if (profile.horizon) {
    const field = getHorizonField(profile.horizon)
    if (field) horizonVerdict = govVal(governance, field)
  }

  let objectifsVerdict: AdequacyVerdict = 'non_evalue'
  if (profile.objectifs?.length) {
    for (const obj of profile.objectifs) {
      const field = getObjectifField(obj)
      if (field) objectifsVerdict = worstVerdict(objectifsVerdict, govVal(governance, field))
    }
  }

  const objectifsGlobalVerdict = worstVerdict(horizonVerdict, objectifsVerdict)

  // ── Verdict global ─────────────────────────────────────────────────────────
  const allAxes: AdequacyVerdict[] = [
    typeClientVerdict,
    connaissanceExperienceVerdict,
    capaciteVerdict,
    risqueVerdict,
    objectifsGlobalVerdict,
  ]
  const evaluated = allAxes.filter((v) => v !== 'non_evalue')
  let global: AdequacyVerdict = 'non_evalue'
  if (evaluated.length > 0) {
    if (evaluated.includes('negatif')) global = 'negatif'
    else if (evaluated.includes('neutre')) global = 'neutre'
    else global = 'positif'
  }

  return {
    axes: {
      type_client: { label: 'Type de client', verdict: typeClientVerdict },
      connaissance_experience: {
        label: 'Connaissance & expérience',
        verdict: connaissanceExperienceVerdict,
        detail:
          connaissanceVerdict !== experienceVerdict &&
          connaissanceVerdict !== 'non_evalue' &&
          experienceVerdict !== 'non_evalue'
            ? `Connaissance : ${connaissanceVerdict} / Expérience : ${experienceVerdict}`
            : undefined,
      },
      capacite_pertes: { label: 'Capacité à supporter des pertes', verdict: capaciteVerdict },
      tolerance_risque: {
        label: 'Tolérance au risque',
        verdict: risqueVerdict,
        detail: profile.sri ? `SRI déclaré : ${profile.sri}` : undefined,
      },
      objectifs: {
        label: 'Objectifs et besoins',
        verdict: objectifsGlobalVerdict,
        detail:
          horizonVerdict !== objectifsVerdict &&
          horizonVerdict !== 'non_evalue' &&
          objectifsVerdict !== 'non_evalue'
            ? `Horizon : ${horizonVerdict} / Objectifs : ${objectifsVerdict}`
            : undefined,
      },
    },
    global,
    is_negative_market: global === 'negatif',
    is_positive_market: global === 'positif',
  }
}
