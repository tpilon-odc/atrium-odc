import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../helpers/app'
import {
  setupTestFixtures, cleanupTestFixtures,
  TEST_USER_ID, TEST_USER_EMAIL, TEST_CABINET_ID,
  TEST_ADMIN_ID, TEST_ADMIN_EMAIL,
  TEST_CHAMBER_ID, TEST_CHAMBER_EMAIL,
} from '../helpers/fixtures'
import { GlobalRole } from '@cgp/db'

// L'admin appelle ces routes — doit être platform_admin
const adminUser = { id: TEST_ADMIN_ID, email: TEST_ADMIN_EMAIL, globalRole: GlobalRole.platform_admin }

describe('Admin — Platform Users', () => {
  let app: ReturnType<typeof buildApp>

  beforeAll(async () => {
    await setupTestFixtures()
    app = buildApp(adminUser)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await cleanupTestFixtures()
  })

  // ── GET /admin/platform-users ─────────────────────────────────────────────

  describe('GET /api/v1/admin/platform-users', () => {
    it('retourne la liste des utilisateurs', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/admin/platform-users' })
      expect(res.statusCode).toBe(200)
      const users = res.json().data.users
      expect(users).toBeInstanceOf(Array)
      expect(users.length).toBeGreaterThan(0)
    })

    it('inclut le champ isActive', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/admin/platform-users' })
      const users = res.json().data.users
      expect(users[0]).toHaveProperty('isActive')
    })

    it('filtre par rôle', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/platform-users?role=${GlobalRole.chamber}`,
      })
      expect(res.statusCode).toBe(200)
      const users = res.json().data.users
      expect(users.every((u: { globalRole: string }) => u.globalRole === GlobalRole.chamber)).toBe(true)
    })

    it('filtre par recherche email', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/platform-users?search=chamber`,
      })
      expect(res.statusCode).toBe(200)
      const users = res.json().data.users
      expect(users.some((u: { email: string }) => u.email === TEST_CHAMBER_EMAIL)).toBe(true)
    })
  })

  // ── PATCH /admin/platform-users/:id ──────────────────────────────────────

  describe('PATCH /api/v1/admin/platform-users/:id', () => {
    it('change le rôle d\'un utilisateur non-cabinet', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/platform-users/${TEST_CHAMBER_ID}`,
        payload: { globalRole: GlobalRole.regulator },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.user.globalRole).toBe(GlobalRole.regulator)
    })

    it('peut désactiver un utilisateur cabinet', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/platform-users/${TEST_USER_ID}`,
        payload: { isActive: false },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.user.isActive).toBe(false)
    })

    it('peut réactiver un utilisateur', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/platform-users/${TEST_USER_ID}`,
        payload: { isActive: true },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.user.isActive).toBe(true)
    })

    it('empêche de se désactiver soi-même', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/platform-users/${TEST_ADMIN_ID}`,
        payload: { isActive: false },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toHaveProperty('code', 'SELF_DISABLE')
    })

    it('empêche de changer le rôle d\'un cabinet user', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/platform-users/${TEST_USER_ID}`,
        payload: { globalRole: GlobalRole.platform_admin },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toHaveProperty('code', 'FORBIDDEN')
    })

    it('retourne 404 pour un utilisateur inexistant', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/platform-users/00000000-0000-0000-0000-000000000099',
        payload: { isActive: false },
      })
      expect(res.statusCode).toBe(404)
    })

    it('rejette un body vide', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/platform-users/${TEST_CHAMBER_ID}`,
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toHaveProperty('code', 'VALIDATION_ERROR')
    })
  })

  // ── DELETE /admin/platform-users/:id ─────────────────────────────────────

  describe('DELETE /api/v1/admin/platform-users/:id', () => {
    it('désactive (soft-delete) un utilisateur', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/platform-users/${TEST_CHAMBER_ID}`,
      })
      expect(res.statusCode).toBe(204)
    })

    it('empêche de se supprimer soi-même', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/platform-users/${TEST_ADMIN_ID}`,
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toHaveProperty('code', 'SELF_DELETE')
    })
  })

  // ── 403 si non-admin ──────────────────────────────────────────────────────

  describe('Accès refusé aux non-admins', () => {
    let userApp: ReturnType<typeof buildApp>

    beforeAll(async () => {
      userApp = buildApp({ id: TEST_USER_ID, email: TEST_USER_EMAIL, globalRole: GlobalRole.cabinet_user, cabinetId: TEST_CABINET_ID })
      await userApp.ready()
    })

    afterAll(async () => {
      await userApp.close()
    })

    it('GET platform-users retourne 403', async () => {
      const res = await userApp.inject({ method: 'GET', url: '/api/v1/admin/platform-users' })
      expect(res.statusCode).toBe(403)
    })
  })
})
