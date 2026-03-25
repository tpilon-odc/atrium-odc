import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../helpers/app'
import {
  setupTestFixtures, cleanupTestFixtures, createContact,
  TEST_USER_ID, TEST_USER_EMAIL, TEST_CABINET_ID,
} from '../helpers/fixtures'
import { GlobalRole } from '@cgp/db'

const user = { id: TEST_USER_ID, email: TEST_USER_EMAIL, globalRole: GlobalRole.cabinet_user, cabinetId: TEST_CABINET_ID }

describe('Contacts', () => {
  let app: ReturnType<typeof buildApp>

  beforeAll(async () => {
    await setupTestFixtures()
    app = buildApp(user)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await cleanupTestFixtures()
  })

  // ── GET /contacts ────────────────────────────────────────────────────────

  describe('GET /api/v1/contacts', () => {
    it('retourne une liste vide si aucun contact', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/contacts' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.contacts).toBeInstanceOf(Array)
      expect(body.data).toHaveProperty('hasMore')
      expect(body.data).toHaveProperty('total')
    })

    it('retourne les contacts du cabinet', async () => {
      const contact = await createContact({ lastName: 'Martin', firstName: 'Alice' })
      const res = await app.inject({ method: 'GET', url: '/api/v1/contacts' })
      expect(res.statusCode).toBe(200)
      const ids = res.json().data.contacts.map((c: { id: string }) => c.id)
      expect(ids).toContain(contact.id)
    })

    it('filtre par type', async () => {
      await createContact({ type: 'client', lastName: 'Client' })
      await createContact({ type: 'prospect', lastName: 'Prospect' })
      const res = await app.inject({ method: 'GET', url: '/api/v1/contacts?type=client' })
      expect(res.statusCode).toBe(200)
      const contacts = res.json().data.contacts
      expect(contacts.every((c: { type: string }) => c.type === 'client')).toBe(true)
    })

    it('filtre par recherche textuelle', async () => {
      await createContact({ lastName: 'Recherché', firstName: 'Unique' })
      const res = await app.inject({ method: 'GET', url: '/api/v1/contacts?search=Recherché' })
      expect(res.statusCode).toBe(200)
      const contacts = res.json().data.contacts
      expect(contacts.length).toBeGreaterThan(0)
      expect(contacts[0].lastName).toBe('Recherché')
    })

    it('retourne hasMore et nextCursor quand > limit', async () => {
      // Crée 3 contacts supplémentaires
      await Promise.all([1, 2, 3].map((i) => createContact({ lastName: `Paginé${i}` })))
      const res = await app.inject({ method: 'GET', url: '/api/v1/contacts?limit=2' })
      expect(res.statusCode).toBe(200)
      const body = res.json().data
      expect(body.hasMore).toBe(true)
      expect(body.nextCursor).toBeTruthy()
    })

    it('retourne le total réel', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/contacts?limit=1' })
      expect(res.statusCode).toBe(200)
      const body = res.json().data
      expect(body.total).toBeGreaterThan(1)
      expect(body.contacts.length).toBe(1)
    })
  })

  // ── POST /contacts ───────────────────────────────────────────────────────

  describe('POST /api/v1/contacts', () => {
    it('crée un contact valide', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/contacts',
        payload: { type: 'client', lastName: 'Nouveau', firstName: 'Contact', email: 'nouveau@test.local' },
      })
      expect(res.statusCode).toBe(201)
      const contact = res.json().data.contact
      expect(contact.lastName).toBe('Nouveau')
      expect(contact.cabinetId).toBe(TEST_CABINET_ID)
    })

    it('rejette un contact sans lastName', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/contacts',
        payload: { type: 'CLIENT' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toHaveProperty('code', 'VALIDATION_ERROR')
    })

    it('rejette un type invalide', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/contacts',
        payload: { type: 'invalide', lastName: 'Test' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ── GET /contacts/:id ────────────────────────────────────────────────────

  describe('GET /api/v1/contacts/:id', () => {
    it('retourne un contact existant', async () => {
      const contact = await createContact({ lastName: 'GetTest' })
      const res = await app.inject({ method: 'GET', url: `/api/v1/contacts/${contact.id}` })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.contact.id).toBe(contact.id)
    })

    it('retourne 404 pour un contact inexistant', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/contacts/00000000-0000-0000-0000-000000000099' })
      expect(res.statusCode).toBe(404)
    })
  })

  // ── PATCH /contacts/:id ──────────────────────────────────────────────────

  describe('PATCH /api/v1/contacts/:id', () => {
    it('met à jour un contact', async () => {
      const contact = await createContact({ lastName: 'Avant' })
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/contacts/${contact.id}`,
        payload: { lastName: 'Après', phone: '0600000000' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.contact.lastName).toBe('Après')
      expect(res.json().data.contact.phone).toBe('0600000000')
    })

    it('retourne 404 pour un contact inexistant', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/contacts/00000000-0000-0000-0000-000000000099',
        payload: { lastName: 'Test' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ── DELETE /contacts/:id ─────────────────────────────────────────────────

  describe('DELETE /api/v1/contacts/:id', () => {
    it('supprime (soft-delete) un contact', async () => {
      const contact = await createContact({ lastName: 'ASupprimer' })
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/contacts/${contact.id}` })
      expect(res.statusCode).toBe(204)

      // Ne doit plus apparaître dans la liste
      const list = await app.inject({ method: 'GET', url: '/api/v1/contacts' })
      const ids = list.json().data.contacts.map((c: { id: string }) => c.id)
      expect(ids).not.toContain(contact.id)
    })
  })
})
