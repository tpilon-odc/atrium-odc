/**
 * Fixtures de test — crée des données minimales en DB et les nettoie après chaque test.
 * Utilise des UUIDs préfixés pour identifier et supprimer facilement les données de test.
 */
import { prisma } from '../../lib/prisma'
import { GlobalRole } from '@cgp/db'
import { randomUUID } from 'crypto'

// ── Identifiants stables pour les fixtures ────────────────────────────────────

export const TEST_USER_ID = '00000000-0000-0000-0000-000000000010'
export const TEST_USER_EMAIL = 'test@cgp-test.local'
export const TEST_CABINET_ID = '00000000-0000-0000-0000-000000000020'
export const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000030'
export const TEST_ADMIN_EMAIL = 'admin@cgp-test.local'
export const TEST_CHAMBER_ID = '00000000-0000-0000-0000-000000000040'
export const TEST_CHAMBER_EMAIL = 'chamber@cgp-test.local'

// ── Setup / teardown ──────────────────────────────────────────────────────────

export async function setupTestFixtures() {
  // Crée user + cabinet + membre dans cet ordre
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: { id: TEST_USER_ID, email: TEST_USER_EMAIL, globalRole: GlobalRole.cabinet_user },
    update: { email: TEST_USER_EMAIL },
  })

  await prisma.user.upsert({
    where: { id: TEST_ADMIN_ID },
    create: { id: TEST_ADMIN_ID, email: TEST_ADMIN_EMAIL, globalRole: GlobalRole.platform_admin },
    update: { email: TEST_ADMIN_EMAIL },
  })

  await prisma.user.upsert({
    where: { id: TEST_CHAMBER_ID },
    create: { id: TEST_CHAMBER_ID, email: TEST_CHAMBER_EMAIL, globalRole: GlobalRole.chamber },
    update: { email: TEST_CHAMBER_EMAIL },
  })

  await prisma.cabinet.upsert({
    where: { id: TEST_CABINET_ID },
    create: { id: TEST_CABINET_ID, name: 'Cabinet Test' },
    update: {},
  })

  await prisma.cabinetMember.upsert({
    where: { cabinetId_userId: { cabinetId: TEST_CABINET_ID, userId: TEST_USER_ID } },
    create: {
      cabinetId: TEST_CABINET_ID,
      userId: TEST_USER_ID,
      role: 'owner',
      canManageSuppliers: true,
      canManageProducts: true,
      canManageContacts: true,
    },
    update: {},
  })
}

export async function cleanupTestFixtures() {
  // Supprime dans l'ordre inverse des dépendances
  await prisma.shareViewLog.deleteMany({ where: { share: { cabinetId: TEST_CABINET_ID } } })
  await prisma.share.deleteMany({ where: { cabinetId: TEST_CABINET_ID } })
  await prisma.collaboratorTraining.deleteMany({ where: { cabinetId: TEST_CABINET_ID } })
  await prisma.documentTag.deleteMany({ where: { document: { cabinetId: TEST_CABINET_ID } } })
  await prisma.documentLink.deleteMany({ where: { document: { cabinetId: TEST_CABINET_ID } } })
  await prisma.document.deleteMany({ where: { cabinetId: TEST_CABINET_ID } })
  await prisma.folder.deleteMany({ where: { cabinetId: TEST_CABINET_ID } })
  await prisma.tag.deleteMany({ where: { cabinetId: TEST_CABINET_ID } })
  await prisma.contact.deleteMany({ where: { cabinetId: TEST_CABINET_ID } })
  await prisma.cabinetComplianceAnswer.deleteMany({ where: { cabinetId: TEST_CABINET_ID } })
  await prisma.cabinetMember.deleteMany({ where: { cabinetId: TEST_CABINET_ID } })
  await prisma.cabinet.deleteMany({ where: { id: TEST_CABINET_ID } })
  await prisma.trainingCatalog.deleteMany({ where: { createdBy: { in: [TEST_USER_ID, TEST_ADMIN_ID, TEST_CHAMBER_ID] } } })
  await prisma.user.deleteMany({ where: { id: { in: [TEST_USER_ID, TEST_ADMIN_ID, TEST_CHAMBER_ID] } } })
}

// ── Factories ──────────────────────────────────────────────────────────────────

export async function createContact(overrides: Record<string, unknown> = {}) {
  return prisma.contact.create({
    data: {
      cabinetId: TEST_CABINET_ID,
      type: 'prospect',
      lastName: 'Dupont',
      firstName: 'Jean',
      email: `contact-${randomUUID()}@test.local`,
      ...overrides,
    },
  })
}

export async function createFolder(overrides: Record<string, unknown> = {}) {
  return prisma.folder.create({
    data: {
      cabinetId: TEST_CABINET_ID,
      name: `Dossier-${randomUUID().slice(0, 8)}`,
      ...overrides,
    },
  })
}

export async function createTag(overrides: Record<string, unknown> = {}) {
  return prisma.tag.create({
    data: {
      cabinetId: TEST_CABINET_ID,
      name: `Tag-${randomUUID().slice(0, 8)}`,
      color: '#3B82F6',
      ...overrides,
    },
  })
}

export async function createTrainingCatalogEntry(overrides: Record<string, unknown> = {}) {
  return prisma.trainingCatalog.create({
    data: {
      name: `Formation-${randomUUID().slice(0, 8)}`,
      createdBy: TEST_USER_ID,
      ...overrides,
    },
  })
}

export async function createTraining(trainingId: string, overrides: Record<string, unknown> = {}) {
  return prisma.collaboratorTraining.create({
    data: {
      cabinetId: TEST_CABINET_ID,
      userId: TEST_USER_ID,
      trainingId,
      trainingDate: new Date('2024-01-15'),
      ...overrides,
    },
  })
}
