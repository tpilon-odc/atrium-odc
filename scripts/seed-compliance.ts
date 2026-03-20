/**
 * Seed conformité — crée des phases et items réalistes pour un cabinet CGP
 * Usage : npx tsx scripts/seed-compliance.ts
 *
 * Nécessite un token platform_admin dans ADMIN_TOKEN ou le premier user créé.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const API_URL = process.env.SUPABASE_URL ? 'http://localhost:3001' : 'http://localhost:3001'
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@cgp-test.local'
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!'

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function api(path: string, options: RequestInit & { token?: string }) {
  const { token, ...rest } = options
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${path} — ${JSON.stringify(json)}`)
  return json.data
}

// ── Données ────────────────────────────────────────────────────────────────────

const PHASES = [
  {
    label: 'Enregistrement & Statuts',
    order: 1,
    items: [
      {
        label: 'Numéro ORIAS',
        type: 'text',
        config: { placeholder: 'Ex: 12345678' },
        isRequired: true,
        validityMonths: 12,
        alertBeforeDays: [30, 7],
        order: 1,
      },
      {
        label: 'Statut(s) exercé(s)',
        type: 'checkbox',
        config: { options: ['IAS', 'CIF', 'IOBSP', 'CJA', 'IFP'] },
        isRequired: true,
        validityMonths: null,
        alertBeforeDays: [],
        order: 2,
      },
      {
        label: 'Forme juridique du cabinet',
        type: 'radio',
        config: { options: ['EI', 'EURL', 'SARL', 'SAS', 'SASU', 'SA', 'Autre'] },
        isRequired: true,
        validityMonths: null,
        alertBeforeDays: [],
        order: 3,
      },
      {
        label: "Extrait Kbis ou avis de situation SIRENE (moins de 3 mois)",
        type: 'doc',
        config: {},
        isRequired: true,
        validityMonths: 3,
        alertBeforeDays: [30, 14],
        order: 4,
      },
    ],
  },
  {
    label: 'Assurances & Garanties',
    order: 2,
    items: [
      {
        label: 'Attestation RC Professionnelle en cours de validité',
        type: 'doc',
        config: {},
        isRequired: true,
        validityMonths: 12,
        alertBeforeDays: [60, 30, 7],
        order: 1,
      },
      {
        label: 'Garantie financière (si encaissement de fonds)',
        type: 'radio',
        config: { options: ['Oui — document joint', 'Non applicable'] },
        isRequired: true,
        validityMonths: 12,
        alertBeforeDays: [30],
        order: 2,
      },
      {
        label: 'Compagnie(s) assureur(s) RC Pro',
        type: 'text',
        config: { placeholder: 'Ex: Allianz, AXA…' },
        isRequired: false,
        validityMonths: null,
        alertBeforeDays: [],
        order: 3,
      },
    ],
  },
  {
    label: 'LCB-FT — Lutte contre le blanchiment',
    order: 3,
    items: [
      {
        label: "Procédure LCB-FT rédigée et signée",
        type: 'doc',
        config: {},
        isRequired: true,
        validityMonths: 24,
        alertBeforeDays: [60, 30],
        order: 1,
      },
      {
        label: 'Classification des risques clients effectuée',
        type: 'radio',
        config: { options: ['Oui — mise à jour < 12 mois', 'En cours', 'Non'] },
        isRequired: true,
        validityMonths: 12,
        alertBeforeDays: [30],
        order: 2,
      },
      {
        label: 'Déclarant TRACFIN désigné',
        type: 'text',
        config: { placeholder: 'Nom du déclarant' },
        isRequired: true,
        validityMonths: null,
        alertBeforeDays: [],
        order: 3,
      },
      {
        label: "Outils de screening utilisés",
        type: 'checkbox',
        config: { options: ['Dow Jones Risk & Compliance', 'Outil interne', 'Complyadvantage', 'Autre'] },
        isRequired: false,
        validityMonths: null,
        alertBeforeDays: [],
        order: 4,
      },
    ],
  },
  {
    label: 'Formation continue',
    order: 4,
    items: [
      {
        label: 'Heures de formation suivies cette année (min. 14h)',
        type: 'text',
        config: { placeholder: 'Ex: 15' },
        isRequired: true,
        validityMonths: 12,
        alertBeforeDays: [60],
        order: 1,
      },
      {
        label: 'Attestation(s) de formation',
        type: 'doc',
        config: {},
        isRequired: true,
        validityMonths: 12,
        alertBeforeDays: [60, 30],
        order: 2,
      },
      {
        label: "Domaines couverts par les formations",
        type: 'checkbox',
        config: { options: ['Réglementation', 'Finance / Produits', 'LCB-FT', 'RGPD', 'Éthique', 'Autre'] },
        isRequired: false,
        validityMonths: null,
        alertBeforeDays: [],
        order: 3,
      },
    ],
  },
]

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seed conformité — CGP Platform\n')

  // Étape 1 — s'assurer que le user a le rôle platform_admin via service role
  console.log(`Vérification du rôle admin pour ${EMAIL}…`)
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
  const targetUser = usersData?.users?.find((u) => u.email === EMAIL)
  if (!targetUser) {
    console.error(`❌ Utilisateur ${EMAIL} introuvable. Créez d'abord un compte via /signup.`)
    process.exit(1)
  }
  if (targetUser.app_metadata?.global_role !== 'platform_admin') {
    await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      app_metadata: { ...targetUser.app_metadata, global_role: 'platform_admin' },
    })
    console.log('✅ Rôle platform_admin assigné\n')
  } else {
    console.log('✅ Rôle platform_admin déjà en place\n')
  }

  // Étape 2 — login pour obtenir un token frais avec le bon rôle
  console.log(`Connexion avec ${EMAIL}…`)
  let token: string
  try {
    const auth = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    token = auth.session.access_token
    console.log(`✅ Connecté\n`)
  } catch (e) {
    console.error('❌ Login échoué:', (e as Error).message)
    process.exit(1)
  }

  // Création des phases et items
  for (const phaseData of PHASES) {
    const { items, ...phaseBody } = phaseData
    console.log(`📋 Phase: ${phaseBody.name}`)

    let phaseId: string
    try {
      const result = await api('/api/v1/compliance/phases', {
        method: 'POST',
        body: JSON.stringify({ ...phaseBody, isActive: true }),
        token,
      })
      phaseId = result.phase.id
      console.log(`   ✅ Créée (id: ${phaseId})`)
    } catch (e) {
      console.error(`   ❌ Erreur: ${(e as Error).message}`)
      continue
    }

    for (const item of items) {
      try {
        await api(`/api/v1/compliance/phases/${phaseId}/items`, {
          method: 'POST',
          body: JSON.stringify(item),
          token,
        })
        console.log(`   ├─ ✅ Item: ${item.label}`)
      } catch (e) {
        console.error(`   ├─ ❌ Item ${item.label}: ${(e as Error).message}`)
      }
    }
    console.log()
  }

  console.log('✨ Seed terminé ! Rechargez /conformite dans le navigateur.')
}

main().catch(console.error)
