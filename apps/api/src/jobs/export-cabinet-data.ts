import archiver from 'archiver'
import { Readable } from 'stream'
import { prisma } from '../lib/prisma'
import { uploadToMinio, minioNative, BUCKET } from '../lib/minio'

const EXPORT_TTL_DAYS = 7

/**
 * Job — traite les ExportJob en attente pour un cabinet.
 * Produit un ZIP contenant :
 *   - data.json       : toutes les métadonnées du cabinet
 *   - documents/…     : fichiers hébergés, organisés par arborescence de dossiers
 *
 * Appelé par cron toutes les 5 minutes depuis index.ts.
 */
export async function runExportCabinetDataJob(): Promise<void> {
  // Expire les jobs DONE dont la date d'expiration est passée
  await prisma.exportJob.updateMany({
    where: { status: 'DONE', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })

  const pending = await prisma.exportJob.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 5,
  })

  if (!pending.length) return

  for (const job of pending) {
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING' },
    })

    try {
      const { metadata, documents, foldersMap } = await collectCabinetData(job.cabinetId)

      const zipBuffer = await buildZip(metadata, documents, foldersMap)

      const storagePath = `cabinets/${job.cabinetId}/exports/${job.id}.zip`
      await uploadToMinio(storagePath, zipBuffer, 'application/zip')

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + EXPORT_TTL_DAYS)

      await prisma.exportJob.update({
        where: { id: job.id },
        data: { status: 'DONE', storagePath, expiresAt, completedAt: new Date() },
      })

      console.log(`[export-cabinet-data] Job ${job.id} terminé — ${storagePath}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[export-cabinet-data] Erreur pour job ${job.id}:`, err)
      await prisma.exportJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: message, completedAt: new Date() },
      })
    }
  }
}

// ── ZIP ──────────────────────────────────────────────────────────────────────

async function buildZip(
  metadata: object,
  documents: Awaited<ReturnType<typeof collectCabinetData>>['documents'],
  foldersMap: Map<string, string>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)

    // data.json — toutes les métadonnées
    const json = JSON.stringify(metadata, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v, 2)
    archive.append(Buffer.from(json, 'utf-8'), { name: 'data.json' })

    // Fichiers hébergés — ajout séquentiel via Readable streams
    const hosted = documents.filter((d) => d.storageMode === 'hosted' && d.storagePath)

    let chain = Promise.resolve()
    for (const doc of hosted) {
      chain = chain.then(async () => {
        try {
          const stream = await minioNative.getObject(BUCKET, doc.storagePath!)
          const folderPath = buildFolderPath(doc.folderId, foldersMap)
          const safeName = doc.name.replace(/[/\\]/g, '_')
          const entryPath = folderPath
            ? `documents/${folderPath}/${safeName}`
            : `documents/${safeName}`
          archive.append(stream as unknown as Readable, { name: entryPath })
        } catch (e) {
          console.warn(`[export-cabinet-data] Fichier ignoré (${doc.storagePath}):`, e)
        }
      })
    }

    chain.then(() => archive.finalize()).catch(reject)
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Reconstruit le chemin complet d'un dossier : "Contrats/Sous-dossier" */
function buildFolderPath(folderId: string | null, foldersMap: Map<string, string>): string {
  if (!folderId) return ''
  return foldersMap.get(folderId) ?? ''
}

/**
 * Construit une Map<id, fullPath> pour tous les dossiers.
 * Exemple : { "abc": "Contrats/Mandats" }
 */
function buildFoldersMap(folders: { id: string; name: string; parentId: string | null }[]): Map<string, string> {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const pathCache = new Map<string, string>()

  function getPath(id: string): string {
    if (pathCache.has(id)) return pathCache.get(id)!
    const folder = byId.get(id)
    if (!folder) return ''
    const parent = folder.parentId ? getPath(folder.parentId) : ''
    const path = parent ? `${parent}/${folder.name}` : folder.name
    pathCache.set(id, path)
    return path
  }

  folders.forEach((f) => getPath(f.id))
  return pathCache
}

// ── Collecte ────────────────────────────────────────────────────────────────

async function collectCabinetData(cabinetId: string) {
  const [cabinet, members, contacts, documents, suppliers, trainings, complianceAnswers, folders, tags] =
    await Promise.all([
      prisma.cabinet.findUnique({ where: { id: cabinetId } }),

      prisma.cabinetMember.findMany({
        where: { cabinetId, deletedAt: null },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),

      prisma.contact.findMany({
        where: { cabinetId, deletedAt: null },
        orderBy: { lastName: 'asc' },
      }),

      prisma.document.findMany({
        where: { cabinetId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          folder: { select: { id: true, name: true } },
          tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
        },
      }),

      prisma.cabinetSupplier.findMany({
        where: { cabinetId },
        include: { supplier: true },
        orderBy: { supplier: { name: 'asc' } },
      }),

      prisma.collaboratorTraining.findMany({
        where: { cabinetId, deletedAt: null },
        include: {
          training: true,
          user: { select: { email: true } },
        },
        orderBy: { trainingDate: 'desc' },
      }),

      prisma.cabinetComplianceAnswer.findMany({
        where: { cabinetId, deletedAt: null },
        include: {
          item: { include: { phase: { select: { label: true } } } },
        },
        orderBy: { item: { phase: { order: 'asc' } } },
      }),

      prisma.folder.findMany({
        where: { cabinetId },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      }),

      prisma.tag.findMany({
        where: {
          OR: [
            { cabinetId: null, isSystem: true },
            { cabinetId },
          ],
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      }),
    ])

  const foldersMap = buildFoldersMap(folders)

  const metadata = {
    exportedAt: new Date().toISOString(),
    cabinet,
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
    })),
    contacts: contacts.map((c) => ({
      id: c.id,
      type: c.type,
      lastName: c.lastName,
      firstName: c.firstName,
      email: c.email,
      phone: c.phone,
      createdAt: c.createdAt,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      storageMode: d.storageMode,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes?.toString() ?? null,
      folderPath: d.folderId ? (foldersMap.get(d.folderId) ?? null) : null,
      tags: d.tags.map((t) => t.tag),
      createdAt: d.createdAt,
    })),
    folders,
    tags,
    suppliers: suppliers.map((cs) => ({
      id: cs.supplier.id,
      name: cs.supplier.name,
      category: cs.supplier.category,
      isActive: cs.isActive,
      privateRating: cs.privateRating,
      privateNote: cs.privateNote,
    })),
    trainings: trainings.map((t) => ({
      id: t.id,
      collaborateur: t.user.email,
      formation: t.training.name,
      organizer: t.training.organizer,
      category: t.training.category,
      date: t.trainingDate,
      hoursCompleted: t.hoursCompleted,
      notes: t.notes,
    })),
    complianceAnswers: complianceAnswers.map((a) => ({
      id: a.id,
      phase: a.item.phase.label,
      item: a.item.label,
      type: a.item.type,
      status: a.status,
      submittedAt: a.submittedAt,
      expiresAt: a.expiresAt,
    })),
  }

  // documents bruts nécessaires pour télécharger les fichiers depuis MinIO
  const rawDocuments = documents.map((d) => ({
    storagePath: d.storagePath,
    folderId: d.folderId,
    name: d.name,
    storageMode: d.storageMode as string,
  }))

  return { metadata, documents: rawDocuments, foldersMap }
}
