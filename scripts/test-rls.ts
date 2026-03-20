/**
 * Script de test RLS — CGP Platform
 * Vérifie l'isolation des données entre cabinets et les triggers DB.
 *
 * Usage : npx tsx scripts/test-rls.ts
 */

import 'dotenv/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`)
    passed++
  } else {
    console.log(`  ❌ FAIL  ${label}${detail ? `\n         → ${detail}` : ''}`)
    failed++
  }
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}\n${title}\n${'─'.repeat(60)}`)
}

async function createUserAndGetClient(
  email: string,
  password: string
): Promise<{ client: SupabaseClient; userId: string; token: string }> {
  // Supprime l'utilisateur s'il existe déjà
  const { data: existing } = await admin.auth.admin.listUsers()
  const found = existing?.users?.find((u) => u.email === email)
  if (found) {
    await admin.auth.admin.deleteUser(found.id)
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Création user ${email} échouée: ${error?.message}`)

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: session, error: loginError } = await client.auth.signInWithPassword({ email, password })
  if (loginError || !session.session) throw new Error(`Login ${email} échoué: ${loginError?.message}`)

  return { client, userId: data.user.id, token: session.session.access_token }
}

async function createCabinet(
  adminClient: SupabaseClient,
  userId: string,
  name: string
): Promise<string> {
  // Insère le cabinet directement via service role (contourne RLS pour setup)
  const newId = randomUUID()
  const { data, error } = await adminClient
    .from('cabinets')
    .insert({ id: newId, name, subscription_status: 'active' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Création cabinet ${name}: ${error?.message}`)

  const cabinetId = data.id

  // Insère le membre owner
  const { error: memberError } = await adminClient.from('cabinet_members').insert({
    id: randomUUID(),
    cabinet_id: cabinetId,
    user_id: userId,
    role: 'owner',
  })
  if (memberError) throw new Error(`Création member ${name}: ${memberError.message}`)

  return cabinetId
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔒 Test RLS & Triggers — CGP Platform\n')

  // ── Setup : deux utilisateurs + deux cabinets ─────────────────────────────
  section('1. Setup — Création des utilisateurs et cabinets')

  const emailA = `rls-test-a-${Date.now()}@cgp-test.local`
  const emailB = `rls-test-b-${Date.now()}@cgp-test.local`
  const password = 'Test1234!'

  let clientA: SupabaseClient, userIdA: string
  let clientB: SupabaseClient, userIdB: string
  let cabinetIdA: string, cabinetIdB: string

  try {
    ;({ client: clientA, userId: userIdA } = await createUserAndGetClient(emailA, password))
    ;({ client: clientB, userId: userIdB } = await createUserAndGetClient(emailB, password))
    console.log(`  ℹ️  User A: ${userIdA}`)
    console.log(`  ℹ️  User B: ${userIdB}`)

    cabinetIdA = await createCabinet(admin, userIdA, 'Cabinet A (test RLS)')
    cabinetIdB = await createCabinet(admin, userIdB, 'Cabinet B (test RLS)')
    console.log(`  ℹ️  Cabinet A: ${cabinetIdA}`)
    console.log(`  ℹ️  Cabinet B: ${cabinetIdB}`)
    assert('User A créé', !!userIdA)
    assert('User B créé', !!userIdB)
    assert('Cabinet A créé', !!cabinetIdA)
    assert('Cabinet B créé', !!cabinetIdB)
  } catch (e: any) {
    console.error('Setup fatal:', e.message)
    process.exit(1)
  }

  // ── Section 2 : création de données avec le token A ───────────────────────
  section('2. Création de données avec le token du cabinet A')

  // Contact
  let contactId: string | null = null
  {
    const { data, error } = await clientA.from('contacts').insert({
      id: randomUUID(),
      cabinet_id: cabinetIdA,
      type: 'prospect',
      last_name: 'Dupont',
      first_name: 'Alice',
      email: 'alice@example.com',
    }).select('id').single()
    assert('A peut créer un contact', !error && !!data?.id, error?.message)
    contactId = data?.id ?? null
  }

  // Supplier (communautaire) + cabinet_supplier
  let supplierId: string | null = null
  let cabinetSupplierId: string | null = null
  {
    const { data: sup, error: supErr } = await admin.from('suppliers').insert({
      id: randomUUID(),
      name: 'Fournisseur Test RLS',
      created_by: userIdA,
    }).select('id').single()
    assert('Supplier créé (via admin)', !supErr && !!sup?.id, supErr?.message)
    supplierId = sup?.id ?? null

    if (supplierId) {
      const { data, error } = await clientA.from('cabinet_suppliers').insert({
        id: randomUUID(),
        cabinet_id: cabinetIdA,
        supplier_id: supplierId,
        private_rating: 4,
      }).select('id').single()
      assert('A peut créer un cabinet_supplier', !error && !!data?.id, error?.message)
      cabinetSupplierId = data?.id ?? null
    }
  }

  // Compliance phase + item (via admin) puis réponse (via A)
  let answerId: string | null = null
  {
    const { data: phase } = await admin.from('compliance_phases').insert({
      id: randomUUID(), name: 'Phase Test RLS', order: 99
    }).select('id').single()

    const { data: item } = await admin.from('compliance_items').insert({
      id: randomUUID(),
      phase_id: phase?.id,
      label: 'Item Test RLS',
      type: 'text',
      config: {},
      is_required: true,
      alert_before_days: [],
      order: 1,
    }).select('id').single()

    if (item?.id) {
      const { data, error } = await clientA.from('cabinet_compliance_answers').insert({
        id: randomUUID(),
        cabinet_id: cabinetIdA,
        item_id: item.id,
        answered_by: userIdA,
        value: { text: 'réponse test' },
        status: 'submitted',
      }).select('id').single()
      assert('A peut créer une compliance_answer', !error && !!data?.id, error?.message)
      answerId = data?.id ?? null
    }
  }

  // ── Section 3 : cabinet B tente de lire les données du cabinet A ──────────
  section('3. Cabinet B tente de lire les données de A (doit obtenir 0 résultats)')

  // Contact
  {
    const { data, error } = await clientB
      .from('contacts')
      .select('id')
      .eq('cabinet_id', cabinetIdA)
    assert(
      'B ne voit pas les contacts de A (RLS contacts)',
      !error && data?.length === 0,
      error ? error.message : `Obtenu ${data?.length} ligne(s) — FUITE DE DONNÉES`
    )
  }

  // cabinet_suppliers
  {
    const { data, error } = await clientB
      .from('cabinet_suppliers')
      .select('id')
      .eq('cabinet_id', cabinetIdA)
    assert(
      'B ne voit pas les cabinet_suppliers de A (RLS cabinet_suppliers)',
      !error && data?.length === 0,
      error ? error.message : `Obtenu ${data?.length} ligne(s) — FUITE DE DONNÉES`
    )
  }

  // cabinet_compliance_answers
  {
    const { data, error } = await clientB
      .from('cabinet_compliance_answers')
      .select('id')
      .eq('cabinet_id', cabinetIdA)
    assert(
      'B ne voit pas les compliance_answers de A (RLS compliance_answers)',
      !error && data?.length === 0,
      error ? error.message : `Obtenu ${data?.length} ligne(s) — FUITE DE DONNÉES`
    )
  }

  // B ne peut pas écrire dans le cabinet de A
  {
    const { error } = await clientB.from('contacts').insert({
      id: randomUUID(),
      cabinet_id: cabinetIdA,
      type: 'prospect',
      last_name: 'Intrus',
    })
    assert(
      'B ne peut pas insérer dans les contacts de A (RLS INSERT)',
      !!error,
      error ? undefined : 'Insertion réussie — FUITE RLS INSERT'
    )
  }

  // ── Section 4 : chaque cabinet voit uniquement SES données ───────────────
  section('4. Chaque cabinet voit uniquement ses propres données')

  {
    const { data } = await clientA.from('contacts').select('id')
    assert(
      'A voit ses propres contacts',
      (data?.length ?? 0) >= 1,
      `A voit ${data?.length ?? 0} contact(s)`
    )
  }
  {
    const { data } = await clientB.from('contacts').select('id')
    assert(
      'B voit 0 contacts (il n\'en a pas créé)',
      data?.length === 0,
      `B voit ${data?.length} contact(s)`
    )
  }

  // ── Section 5 : trigger avg_public_rating ────────────────────────────────
  section('5. Trigger avg_public_rating sur supplier_public_ratings')

  if (supplierId) {
    // Note initiale = 4 (via clientA)
    const { error: r1err } = await clientA.from('supplier_public_ratings').insert({
      id: randomUUID(),
      supplier_id: supplierId,
      cabinet_id: cabinetIdA,
      rating: 4,
    })
    assert('Insertion rating 4 (A)', !r1err, r1err?.message)

    // Note de B = 2
    const { error: r2err } = await clientB.from('supplier_public_ratings').insert({
      id: randomUUID(),
      supplier_id: supplierId,
      cabinet_id: cabinetIdB,
      rating: 2,
    })
    assert('Insertion rating 2 (B)', !r2err, r2err?.message)

    // Attend un court instant puis vérifie avg = (4+2)/2 = 3
    await new Promise((r) => setTimeout(r, 200))
    const { data: sup } = await admin.from('suppliers').select('avg_public_rating').eq('id', supplierId).single()
    assert(
      `Trigger avg_public_rating déclenché → avg = 3 (reçu: ${sup?.avg_public_rating})`,
      sup?.avg_public_rating === 3,
      `avg_public_rating = ${sup?.avg_public_rating}`
    )
  }

  // ── Section 6 : trigger updated_at ───────────────────────────────────────
  section('6. Trigger set_updated_at sur cabinet_compliance_answers')

  if (answerId) {
    // Lit updated_at avant
    const { data: before } = await clientA
      .from('cabinet_compliance_answers')
      .select('updated_at')
      .eq('id', answerId)
      .single()

    // Attend 1 seconde puis met à jour
    await new Promise((r) => setTimeout(r, 1100))

    await clientA
      .from('cabinet_compliance_answers')
      .update({ status: 'draft' })
      .eq('id', answerId)

    const { data: after } = await clientA
      .from('cabinet_compliance_answers')
      .select('updated_at')
      .eq('id', answerId)
      .single()

    const changed = before?.updated_at !== after?.updated_at
    assert(
      `Trigger set_updated_at déclenché (avant: ${before?.updated_at?.slice(11, 19)} → après: ${after?.updated_at?.slice(11, 19)})`,
      changed,
      changed ? undefined : 'updated_at inchangé — trigger non déclenché'
    )
  }

  // ── Nettoyage ──────────────────────────────────────────────────────────────
  section('Nettoyage')
  await admin.auth.admin.deleteUser(userIdA).catch(() => {})
  await admin.auth.admin.deleteUser(userIdB).catch(() => {})
  console.log('  ℹ️  Utilisateurs supprimés')

  // ── Résumé ─────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`Résultat : ${passed} PASS  |  ${failed} FAIL`)
  console.log('═'.repeat(60))
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
