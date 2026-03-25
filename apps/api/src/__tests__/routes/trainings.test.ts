import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../helpers/app'
import {
  setupTestFixtures, cleanupTestFixtures,
  createTrainingCatalogEntry, createTraining,
  TEST_USER_ID, TEST_USER_EMAIL, TEST_CABINET_ID,
} from '../helpers/fixtures'
import { GlobalRole } from '@cgp/db'
import { prisma } from '../../lib/prisma'

const user = { id: TEST_USER_ID, email: TEST_USER_EMAIL, globalRole: GlobalRole.cabinet_user, cabinetId: TEST_CABINET_ID }

describe('Trainings', () => {
  let app: ReturnType<typeof buildApp>

  beforeAll(async () => {
    await setupTestFixtures()
    app = buildApp(user)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await cleanupTestFixtures()
    // Nettoie aussi le catalogue (pas lié à un cabinet)
    await prisma.trainingCatalog.deleteMany({ where: { name: { startsWith: 'Formation-' } } })
    await prisma.trainingCatalog.deleteMany({ where: { name: { in: ['Formation Test Cat', 'Cat Modifiable'] } } })
  })

  // ── Catalogue ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/trainings/catalog', () => {
    it('retourne le catalogue', async () => {
      await createTrainingCatalogEntry({ name: 'Formation Test Cat' })
      const res = await app.inject({ method: 'GET', url: '/api/v1/trainings/catalog' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.catalog).toBeInstanceOf(Array)
    })

    it('filtre par recherche', async () => {
      await createTrainingCatalogEntry({ name: 'Formation Unique XYZ' })
      const res = await app.inject({ method: 'GET', url: '/api/v1/trainings/catalog?search=Unique+XYZ' })
      expect(res.statusCode).toBe(200)
      const catalog = res.json().data.catalog
      expect(catalog.length).toBeGreaterThan(0)
      expect(catalog[0].name).toContain('XYZ')
    })
  })

  describe('POST /api/v1/trainings/catalog', () => {
    it('crée une entrée de catalogue', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trainings/catalog',
        payload: { name: 'Cat Modifiable', organizer: 'AMF', defaultHours: 7 },
      })
      expect(res.statusCode).toBe(201)
      const entry = res.json().data.entry
      expect(entry.name).toBe('Cat Modifiable')
      expect(entry.defaultHours).toBe(7)
    })

    it('rejette sans nom', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/v1/trainings/catalog', payload: {} })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toHaveProperty('code', 'VALIDATION_ERROR')
    })
  })

  // ── Suivi collaborateurs ──────────────────────────────────────────────────

  describe('GET /api/v1/trainings', () => {
    it('retourne les formations du cabinet', async () => {
      const catalog = await createTrainingCatalogEntry()
      await createTraining(catalog.id)
      const res = await app.inject({ method: 'GET', url: '/api/v1/trainings' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.trainings).toBeInstanceOf(Array)
      expect(res.json().data.trainings.length).toBeGreaterThan(0)
    })

    it('filtre par userId', async () => {
      const catalog = await createTrainingCatalogEntry()
      const t = await createTraining(catalog.id, { userId: TEST_USER_ID })
      const res = await app.inject({ method: 'GET', url: `/api/v1/trainings?userId=${TEST_USER_ID}` })
      expect(res.statusCode).toBe(200)
      const ids = res.json().data.trainings.map((x: { id: string }) => x.id)
      expect(ids).toContain(t.id)
    })

    it('pagination : limit et nextCursor', async () => {
      const catalog = await createTrainingCatalogEntry()
      await Promise.all([1, 2, 3].map(() => createTraining(catalog.id)))
      const res = await app.inject({ method: 'GET', url: '/api/v1/trainings?limit=2' })
      expect(res.statusCode).toBe(200)
      const body = res.json().data
      expect(body.trainings.length).toBe(2)
      expect(body.hasMore).toBe(true)
      expect(body.nextCursor).toBeTruthy()
    })
  })

  describe('POST /api/v1/trainings', () => {
    it('crée une formation suivie', async () => {
      const catalog = await createTrainingCatalogEntry()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trainings',
        payload: {
          userId: TEST_USER_ID,
          trainingId: catalog.id,
          trainingDate: '2024-06-15',
          hoursCompleted: 7,
        },
      })
      expect(res.statusCode).toBe(201)
      const t = res.json().data.training
      expect(t.userId).toBe(TEST_USER_ID)
      expect(t.cabinetId).toBe(TEST_CABINET_ID)
    })

    it('rejette sans userId', async () => {
      const catalog = await createTrainingCatalogEntry()
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trainings',
        payload: { trainingId: catalog.id, trainingDate: '2024-06-15' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toHaveProperty('code', 'VALIDATION_ERROR')
    })

    it('rejette si trainingId inexistant', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trainings',
        payload: {
          userId: TEST_USER_ID,
          trainingId: '00000000-0000-0000-0000-000000000099',
          trainingDate: '2024-06-15',
        },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('PATCH /api/v1/trainings/:id', () => {
    it('met à jour les heures complétées', async () => {
      const catalog = await createTrainingCatalogEntry()
      const t = await createTraining(catalog.id)
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/trainings/${t.id}`,
        payload: { hoursCompleted: 14, notes: 'Mise à jour' },
      })
      expect(res.statusCode).toBe(200)
      const updated = res.json().data.training
      expect(updated.hoursCompleted).toBe(14)
      expect(updated.notes).toBe('Mise à jour')
    })

    it('retourne 404 pour une formation inexistante', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/trainings/00000000-0000-0000-0000-000000000099',
        payload: { hoursCompleted: 3 },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/v1/trainings/:id', () => {
    it('soft-delete une formation', async () => {
      const catalog = await createTrainingCatalogEntry()
      const t = await createTraining(catalog.id)
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/trainings/${t.id}` })
      expect(res.statusCode).toBe(204)

      const list = await app.inject({ method: 'GET', url: '/api/v1/trainings' })
      const ids = list.json().data.trainings.map((x: { id: string }) => x.id)
      expect(ids).not.toContain(t.id)
    })
  })
})
