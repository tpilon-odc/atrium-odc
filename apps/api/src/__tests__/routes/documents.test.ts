import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../helpers/app'
import {
  setupTestFixtures, cleanupTestFixtures, createFolder, createTag,
  TEST_USER_ID, TEST_USER_EMAIL, TEST_CABINET_ID,
} from '../helpers/fixtures'
import { GlobalRole } from '@cgp/db'
import { prisma } from '../../lib/prisma'

const user = { id: TEST_USER_ID, email: TEST_USER_EMAIL, globalRole: GlobalRole.cabinet_user, cabinetId: TEST_CABINET_ID }

// Crée un document directement en DB (pas d'upload fichier réel en test)
async function createDocument(overrides: Record<string, unknown> = {}) {
  return prisma.document.create({
    data: {
      cabinetId: TEST_CABINET_ID,
      uploadedBy: TEST_USER_ID,
      name: `doc-test-${Date.now()}.pdf`,
      storageMode: 'hosted',
      storagePath: `test/${TEST_CABINET_ID}/doc-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      ...overrides,
    },
  })
}

describe('Documents', () => {
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

  // ── GET /documents ───────────────────────────────────────────────────────

  describe('GET /api/v1/documents', () => {
    it('retourne une liste avec total', async () => {
      await createDocument()
      const res = await app.inject({ method: 'GET', url: '/api/v1/documents' })
      expect(res.statusCode).toBe(200)
      const body = res.json().data
      expect(body).toHaveProperty('documents')
      expect(body).toHaveProperty('total')
      expect(body.total).toBeGreaterThan(0)
    })

    it('filtre par dossier', async () => {
      const folder = await createFolder({ name: 'Dossier filtré' })
      const docInFolder = await createDocument({ folderId: folder.id, name: 'doc-in-folder.pdf' })
      await createDocument({ name: 'doc-no-folder.pdf' })

      const res = await app.inject({ method: 'GET', url: `/api/v1/documents?folderId=${folder.id}` })
      expect(res.statusCode).toBe(200)
      const docs = res.json().data.documents
      expect(docs.every((d: { folderId: string }) => d.folderId === folder.id)).toBe(true)
      expect(docs.map((d: { id: string }) => d.id)).toContain(docInFolder.id)
    })

    it('filtre par tag', async () => {
      const tag = await createTag({ name: 'TagFiltre' })
      const doc = await createDocument({ name: 'doc-tagged.pdf' })
      await prisma.documentTag.create({ data: { documentId: doc.id, tagId: tag.id } })

      const res = await app.inject({ method: 'GET', url: `/api/v1/documents?tagId=${tag.id}` })
      expect(res.statusCode).toBe(200)
      const ids = res.json().data.documents.map((d: { id: string }) => d.id)
      expect(ids).toContain(doc.id)
    })

    it('inclut les tags dans chaque document', async () => {
      const tag = await createTag({ name: 'TagInclus' })
      const doc = await createDocument({ name: 'doc-with-tag.pdf' })
      await prisma.documentTag.create({ data: { documentId: doc.id, tagId: tag.id } })

      const res = await app.inject({ method: 'GET', url: '/api/v1/documents' })
      expect(res.statusCode).toBe(200)
      const found = res.json().data.documents.find((d: { id: string }) => d.id === doc.id)
      expect(found).toBeDefined()
      expect(found.tags).toBeInstanceOf(Array)
      expect(found.tags.some((t: { tag: { id: string } }) => t.tag.id === tag.id)).toBe(true)
    })

    it('pagination : limit et nextCursor', async () => {
      await Promise.all([1, 2, 3].map((i) => createDocument({ name: `paginate-${i}.pdf` })))
      const res = await app.inject({ method: 'GET', url: '/api/v1/documents?limit=2' })
      expect(res.statusCode).toBe(200)
      const body = res.json().data
      expect(body.documents.length).toBe(2)
      expect(body.hasMore).toBe(true)
      expect(body.nextCursor).toBeTruthy()
    })
  })

  // ── PATCH /documents/:id ─────────────────────────────────────────────────

  describe('PATCH /api/v1/documents/:id', () => {
    it('change le dossier d\'un document', async () => {
      const folder = await createFolder({ name: 'Destination' })
      const doc = await createDocument({ name: 'doc-to-move.pdf' })

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/documents/${doc.id}`,
        payload: { folderId: folder.id },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.document.folderId).toBe(folder.id)
    })

    it('peut retirer le dossier (folderId null)', async () => {
      const folder = await createFolder({ name: 'ARetirer' })
      const doc = await createDocument({ folderId: folder.id })

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/documents/${doc.id}`,
        payload: { folderId: null },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.document.folderId).toBeNull()
    })
  })

  // ── Tags ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/documents/:id/tags', () => {
    it('ajoute un tag à un document', async () => {
      const doc = await createDocument({ name: 'doc-add-tag.pdf' })
      const tag = await createTag({ name: 'NouveauTag' })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/documents/${doc.id}/tags`,
        payload: { tagId: tag.id },
      })
      expect(res.statusCode).toBe(201)

      // Vérifie que le tag est bien associé
      const dt = await prisma.documentTag.findFirst({ where: { documentId: doc.id, tagId: tag.id } })
      expect(dt).not.toBeNull()
    })

    it('est idempotent (pas de doublon)', async () => {
      const doc = await createDocument({ name: 'doc-idem-tag.pdf' })
      const tag = await createTag({ name: 'IdempotentTag' })

      await app.inject({ method: 'POST', url: `/api/v1/documents/${doc.id}/tags`, payload: { tagId: tag.id } })
      const res = await app.inject({ method: 'POST', url: `/api/v1/documents/${doc.id}/tags`, payload: { tagId: tag.id } })
      expect(res.statusCode).toBe(201) // pas d'erreur

      const count = await prisma.documentTag.count({ where: { documentId: doc.id, tagId: tag.id } })
      expect(count).toBe(1)
    })
  })

  describe('DELETE /api/v1/documents/:id/tags/:tagId', () => {
    it('retire un tag d\'un document', async () => {
      const doc = await createDocument({ name: 'doc-rm-tag.pdf' })
      const tag = await createTag({ name: 'TagARetirer' })
      await prisma.documentTag.create({ data: { documentId: doc.id, tagId: tag.id } })

      const res = await app.inject({ method: 'DELETE', url: `/api/v1/documents/${doc.id}/tags/${tag.id}` })
      expect(res.statusCode).toBe(204)

      const dt = await prisma.documentTag.findFirst({ where: { documentId: doc.id, tagId: tag.id } })
      expect(dt).toBeNull()
    })
  })

  // ── DELETE /documents/:id ────────────────────────────────────────────────

  describe('DELETE /api/v1/documents/:id', () => {
    it('soft-delete un document', async () => {
      const doc = await createDocument({ name: 'doc-delete.pdf' })
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/documents/${doc.id}` })
      expect(res.statusCode).toBe(204)

      const list = await app.inject({ method: 'GET', url: '/api/v1/documents' })
      const ids = list.json().data.documents.map((d: { id: string }) => d.id)
      expect(ids).not.toContain(doc.id)
    })
  })

  // ── Dossiers ─────────────────────────────────────────────────────────────

  describe('Folders', () => {
    it('GET /api/v1/folders retourne les dossiers du cabinet', async () => {
      await createFolder({ name: 'Dossier visible' })
      const res = await app.inject({ method: 'GET', url: '/api/v1/folders' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.folders.length).toBeGreaterThan(0)
    })

    it('POST /api/v1/folders crée un dossier', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/folders',
        payload: { name: 'Nouveau Dossier' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.folder.name).toBe('Nouveau Dossier')
      expect(res.json().data.folder.cabinetId).toBe(TEST_CABINET_ID)
    })

    it('POST /api/v1/folders crée un sous-dossier', async () => {
      const parent = await createFolder({ name: 'Parent' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/folders',
        payload: { name: 'Enfant', parentId: parent.id },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.folder.parentId).toBe(parent.id)
    })
  })

  // ── Tags (CRUD) ──────────────────────────────────────────────────────────

  describe('Tags CRUD', () => {
    it('GET /api/v1/tags retourne les tags', async () => {
      await createTag({ name: 'TagVisible' })
      const res = await app.inject({ method: 'GET', url: '/api/v1/tags' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.tags).toBeInstanceOf(Array)
    })

    it('POST /api/v1/tags crée un tag', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tags',
        payload: { name: 'TagCréé', color: '#EF4444' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.tag.name).toBe('TagCréé')
    })

    it('DELETE /api/v1/tags/:id supprime un tag', async () => {
      const tag = await createTag({ name: 'TagASuppr' })
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/tags/${tag.id}` })
      expect(res.statusCode).toBe(204)
    })
  })
})
