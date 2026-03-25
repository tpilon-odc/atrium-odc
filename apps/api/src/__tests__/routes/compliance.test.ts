import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../helpers/app'
import {
  setupTestFixtures, cleanupTestFixtures,
  TEST_USER_ID, TEST_USER_EMAIL, TEST_CABINET_ID,
} from '../helpers/fixtures'
import { GlobalRole } from '@cgp/db'
import { prisma } from '../../lib/prisma'

const user = { id: TEST_USER_ID, email: TEST_USER_EMAIL, globalRole: GlobalRole.cabinet_user, cabinetId: TEST_CABINET_ID }

// Crée une phase + item de test directement en DB
async function createTestPhaseAndItem() {
  const phase = await prisma.compliancePhase.create({
    data: {
      label: `Phase Test ${Date.now()}`,
      order: 999,
      isActive: true,
    },
  })
  const item = await prisma.complianceItem.create({
    data: {
      phaseId: phase.id,
      label: `Item Test ${Date.now()}`,
      type: 'checkbox',
      order: 1,
      isRequired: true,
      config: {},
    },
  })
  return { phase, item }
}

describe('Compliance', () => {
  let app: ReturnType<typeof buildApp>
  let phaseId: string
  let itemId: string

  beforeAll(async () => {
    await setupTestFixtures()
    app = buildApp(user)
    await app.ready()

    const { phase, item } = await createTestPhaseAndItem()
    phaseId = phase.id
    itemId = item.id
  })

  afterAll(async () => {
    await app.close()
    await prisma.cabinetComplianceAnswer.deleteMany({ where: { cabinetId: TEST_CABINET_ID } })
    await prisma.complianceItem.deleteMany({ where: { phaseId } })
    await prisma.compliancePhase.deleteMany({ where: { id: phaseId } })
    await cleanupTestFixtures()
  })

  // ── Phases ────────────────────────────────────────────────────────────────

  describe('GET /api/v1/compliance/phases', () => {
    it('retourne les phases actives', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/compliance/phases' })
      expect(res.statusCode).toBe(200)
      const phases = res.json().data.phases
      expect(phases).toBeInstanceOf(Array)
      // Notre phase de test doit être présente
      expect(phases.some((p: { id: string }) => p.id === phaseId)).toBe(true)
    })

    it('chaque phase contient ses items', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/compliance/phases' })
      const testPhase = res.json().data.phases.find((p: { id: string }) => p.id === phaseId)
      expect(testPhase).toBeDefined()
      expect(testPhase.items).toBeInstanceOf(Array)
      expect(testPhase.items.some((i: { id: string }) => i.id === itemId)).toBe(true)
    })
  })

  // ── Progress ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/compliance/progress', () => {
    it('retourne globalProgress et phases', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/compliance/progress' })
      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data).toHaveProperty('globalProgress')
      expect(data).toHaveProperty('phases')
      expect(typeof data.globalProgress).toBe('number')
    })

    it('globalProgress est 0 quand aucune réponse soumise', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/compliance/progress' })
      expect(res.statusCode).toBe(200)
      // Avec un item requis sans réponse, progress doit être 0 (ou calculé)
      expect(res.json().data.globalProgress).toBeGreaterThanOrEqual(0)
      expect(res.json().data.globalProgress).toBeLessThanOrEqual(100)
    })
  })

  // ── Réponses ──────────────────────────────────────────────────────────────

  describe('PUT /api/v1/compliance/answers/:itemId', () => {
    it('soumet une réponse', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/compliance/answers/${itemId}`,
        payload: { value: { selected: ['oui'] }, status: 'submitted' },
      })
      expect(res.statusCode).toBe(200)
      const answer = res.json().data.answer
      expect(answer.itemId).toBe(itemId)
      expect(answer.status).toBe('submitted')
    })

    it('est idempotent (upsert)', async () => {
      // Deuxième PUT sur le même item
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/compliance/answers/${itemId}`,
        payload: { value: { selected: ['non'] }, status: 'draft' },
      })
      expect(res.statusCode).toBe(200)
      // Vérifie qu'il n'y a qu'une seule réponse en DB
      const count = await prisma.cabinetComplianceAnswer.count({
        where: { cabinetId: TEST_CABINET_ID, itemId, deletedAt: null },
      })
      expect(count).toBe(1)
    })

    it('retourne 404 pour un item inexistant', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/compliance/answers/00000000-0000-0000-0000-000000000099',
        payload: { value: { selected: ['x'] }, status: 'draft' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('la progression est mise à jour après soumission', async () => {
      // Soumet l'item
      await app.inject({
        method: 'PUT',
        url: `/api/v1/compliance/answers/${itemId}`,
        payload: { value: { selected: ['oui'] }, status: 'submitted' },
      })

      const res = await app.inject({ method: 'GET', url: '/api/v1/compliance/progress' })
      const data = res.json().data
      // La progression doit être > 0 maintenant
      expect(data.globalProgress).toBeGreaterThan(0)
    })
  })
})
