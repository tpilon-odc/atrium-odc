#!/usr/bin/env node
/**
 * Script de seed de développement
 * Crée un compte, un cabinet, et des données de test
 *
 * Usage : node scripts/seed-dev.mjs
 *         node scripts/seed-dev.mjs --email mon@email.fr --password monpass
 */

const API = 'http://localhost:3001/api/v1'

const args = process.argv.slice(2)
const getArg = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null }

const EMAIL    = getArg('--email')    ?? 'demo@atrium.dev'
const PASSWORD = getArg('--password') ?? 'Demo1234!'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function api(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json.error ?? JSON.stringify(json)}`)
  return json.data
}

function log(emoji, msg) { console.log(`${emoji}  ${msg}`) }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 Seed de développement\n')

  // 1. Inscription
  let token
  try {
    const signup = await api('POST', '/auth/signup', { email: EMAIL, password: PASSWORD })
    token = signup.session.access_token
    log('✅', `Compte créé : ${EMAIL}`)
  } catch (e) {
    if (e.message.includes('déjà utilisé') || e.message.includes('409')) {
      const login = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
      token = login.session.access_token
      log('🔑', `Connecté avec le compte existant : ${EMAIL}`)
    } else {
      throw e
    }
  }

  // 2. Cabinet
  let cabinetId
  try {
    const cab = await api('POST', '/cabinets', {
      name: 'Cabinet Démo Atrium',
      siret: '12345678900014',
      oriasNumber: '12 000 001',
      address: '12 rue de la Paix',
      city: 'Paris',
      postalCode: '75001',
    }, token)
    cabinetId = cab.cabinet.id
    log('🏢', `Cabinet créé : ${cab.cabinet.name}`)
  } catch (e) {
    if (e.message.includes('déjà') || e.message.includes('409') || e.message.includes('exist')) {
      const me = await api('GET', '/cabinets/me', null, token)
      cabinetId = me.cabinet.id
      log('🏢', `Cabinet existant : ${me.cabinet.name}`)
    } else {
      throw e
    }
  }

  // 3. Acceptation CGU
  await api('POST', '/consent', { version: '1.0' }, token)
  log('📋', 'CGU acceptées')

  // 4. Profil utilisateur
  await api('PATCH', '/users/me', {
    firstName: 'Jean',
    lastName: 'Dupont',
    civility: 'M.',
  }, token)
  log('👤', 'Profil mis à jour : M. Jean Dupont')

  // 4. Fournisseurs
  const suppliers = [
    { name: 'Generali France', category: 'Assurance vie', description: 'Leader de l\'assurance vie en France', website: 'https://www.generali.fr', email: 'cgp@generali.fr', phone: '01 58 38 70 00' },
    { name: 'AXA Wealth Management', category: 'Gestion de patrimoine', description: 'Solutions patrimoniales haut de gamme', website: 'https://www.axa.fr', email: 'partenaires@axa.fr' },
    { name: 'Amundi Asset Management', category: 'Gestion d\'actifs', description: 'Premier gestionnaire d\'actifs européen', website: 'https://www.amundi.fr' },
    { name: 'Primonial REIM', category: 'Immobilier', description: 'Gestion de fonds immobiliers SCPI/OPCI', website: 'https://www.primonial.fr' },
    { name: 'Cardif (BNP Paribas)', category: 'Prévoyance', description: 'Assurance prévoyance et santé', email: 'courtage@cardif.fr' },
  ]

  const supplierIds = []
  for (const s of suppliers) {
    const res = await api('POST', '/suppliers', s, token)
    supplierIds.push(res.supplier.id)
    log('🏭', `Fournisseur : ${s.name}`)
  }

  // 5. Produits
  const products = [
    { name: 'Assurance Vie Multisupport Generali', category: 'Assurance vie', description: 'Contrat multisupport avec 300 UC disponibles. Frais de gestion 0,75%/an.' },
    { name: 'SCPI Primopierre', category: 'Immobilier', description: 'SCPI de bureaux en région parisienne. Taux de distribution 4,5%.' },
    { name: 'PER Individuel AXA', category: 'Retraite', description: 'Plan épargne retraite individuel avec sortie en capital ou rente.' },
    { name: 'FCPI Innovation 2024', category: 'Défiscalisation', description: 'Fonds commun de placement dans l\'innovation. Réduction IR 18%.' },
    { name: 'Mandat de gestion Amundi', category: 'Gestion sous mandat', description: 'Mandat discrétionnaire profils prudent/équilibré/dynamique.' },
    { name: 'Contrat de prévoyance Cardif', category: 'Prévoyance', description: 'Garanties décès, invalidité, incapacité de travail.' },
  ]

  for (let i = 0; i < products.length; i++) {
    const res = await api('POST', '/products', products[i], token)
    // Lier au fournisseur correspondant si dispo
    if (supplierIds[i]) {
      await api('POST', `/products/${res.product.id}/suppliers`, { supplierId: supplierIds[i] }, token).catch(() => {})
    }
    log('📦', `Produit : ${products[i].name}`)
  }

  // 6. Outils
  const tools = [
    { name: 'Harvest O2S', category: 'CRM / Gestion cabinet', description: 'Logiciel de gestion de cabinet CGP. Suivi clients, portefeuilles, reporting.' },
    { name: 'Quantalys', category: 'Analyse financière', description: 'Plateforme d\'analyse et de sélection de fonds.' },
    { name: 'DocuSign', category: 'Signature électronique', description: 'Solution de signature électronique conforme eIDAS.' },
    { name: 'Septeo (ex-Orisha)', category: 'Conformité', description: 'Logiciel de conformité réglementaire AMF/ACPR.' },
  ]

  for (const t of tools) {
    await api('POST', '/tools', t, token)
    log('🔧', `Outil : ${t.name}`)
  }

  // 7. Contacts CRM
  const contacts = [
    { lastName: 'Martin', firstName: 'Sophie', email: 'sophie.martin@email.fr', phone: '06 12 34 56 78', type: 'client', profession: 'Médecin libéral', city: 'Paris', postalCode: '75016', maritalStatus: 'marie', dependents: 2 },
    { lastName: 'Bernard', firstName: 'Pierre', email: 'p.bernard@email.fr', phone: '06 23 45 67 89', type: 'client', profession: 'Chef d\'entreprise', city: 'Lyon', postalCode: '69006', maritalStatus: 'marie', dependents: 3 },
    { lastName: 'Dubois', firstName: 'Marie', email: 'marie.dubois@email.fr', type: 'prospect', profession: 'Avocate', city: 'Bordeaux', postalCode: '33000', maritalStatus: 'celibataire' },
    { lastName: 'Leroy', firstName: 'François', email: 'f.leroy@email.fr', phone: '06 45 67 89 01', type: 'client', profession: 'Notaire', city: 'Nantes', postalCode: '44000', maritalStatus: 'pacse' },
    { lastName: 'Moreau', firstName: 'Isabelle', email: 'i.moreau@email.fr', type: 'prospect', profession: 'Directrice commerciale', city: 'Toulouse', postalCode: '31000', maritalStatus: 'divorce', dependents: 1 },
    { lastName: 'Laurent', firstName: 'Thomas', email: 't.laurent@email.fr', type: 'ancien_client', profession: 'Retraité', city: 'Nice', postalCode: '06000', maritalStatus: 'veuf' },
  ]

  for (const c of contacts) {
    await api('POST', '/contacts', c, token)
    log('👥', `Contact : ${c.firstName} ${c.lastName} (${c.type})`)
  }

  // 8. Formations catalogue
  const trainings = [
    { name: 'DDA — Assurance vie et produits d\'épargne', organizer: 'ANACOFI', category: 'Réglementaire', defaultHours: 15 },
    { name: 'MIF2 — Conseil en investissement', organizer: 'CGPC', category: 'Réglementaire', defaultHours: 7 },
    { name: 'LCB-FT — Lutte contre le blanchiment', organizer: 'ACPR', category: 'Conformité', defaultHours: 3 },
    { name: 'Gestion de patrimoine — Fiscalité 2024', organizer: 'CGPC', category: 'Technique', defaultHours: 8 },
  ]

  for (const t of trainings) {
    await api('POST', '/trainings/catalog', t, token).catch(() => {})
    log('🎓', `Formation catalogue : ${t.name}`)
  }

  console.log('\n✨ Seed terminé !\n')
  console.log(`   Email    : ${EMAIL}`)
  console.log(`   Password : ${PASSWORD}`)
  console.log(`   App      : http://localhost:3000\n`)
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1) })
