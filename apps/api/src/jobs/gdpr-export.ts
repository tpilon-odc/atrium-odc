import archiver from 'archiver'
import { Readable } from 'stream'
import { prisma } from '../lib/prisma'
import { uploadToMinio, minioNative, BUCKET } from '../lib/minio'
import { sendGdprRequestConfirmEmail } from '../lib/mailer'

const DOWNLOAD_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 jours

/**
 * Job — traite les GdprRequest ACCESS en statut PROCESSING.
 * Produit un ZIP complet :
 *   - donnees/cabinet.json · membres.json · conformite.json · contacts.json
 *     interactions.json · fournisseurs.json · produits.json · formations.json
 *     partages.json · consentements.json
 *   - documents/ : même arborescence que la GED
 *
 * Appelé par cron toutes les 5 minutes depuis index.ts.
 */
export async function runGdprExportJob(): Promise<void> {
  const requests = await prisma.gdprRequest.findMany({
    where: { type: 'ACCESS', status: 'PROCESSING' },
    orderBy: { createdAt: 'asc' },
    take: 3,
    include: {
      cabinet: { select: { name: true } },
      requester: { select: { email: true } },
    },
  })

  if (!requests.length) return

  for (const req of requests) {
    try {
      const data = await collectAllCabinetData(req.cabinetId)
      const zipBuffer = await buildGdprZip(data)

      const storagePath = `cabinets/${req.cabinetId}/gdpr-exports/${req.id}.zip`
      await uploadToMinio(storagePath, zipBuffer, 'application/zip')

      const downloadUrl = await minioNative.presignedGetObject(BUCKET, storagePath, DOWNLOAD_TTL_SECONDS)

      await prisma.gdprRequest.update({
        where: { id: req.id },
        data: { status: 'DONE', exportPath: storagePath, processedAt: new Date() },
      })

      // Email au cabinet avec le lien de téléchargement
      sendGdprRequestConfirmEmail({
        to: req.requester.email,
        cabinetName: req.cabinet.name,
        type: 'ACCESS',
        status: 'DONE',
        downloadUrl,
      }).catch(() => { /* non bloquant */ })

      console.log(`[gdpr-export] Demande ${req.id} traitée — ${storagePath}`)
    } catch (err) {
      console.error(`[gdpr-export] Erreur pour demande ${req.id}:`, err)
      await prisma.gdprRequest.update({
        where: { id: req.id },
        data: { status: 'PENDING', response: `Erreur lors de la génération : ${err instanceof Error ? err.message : String(err)}` },
      }).catch(() => { /* ignore */ })
    }
  }
}

// ── ZIP ──────────────────────────────────────────────────────────────────────

async function buildGdprZip(data: Awaited<ReturnType<typeof collectAllCabinetData>>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)

    const serialize = (obj: unknown) =>
      JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)

    // Données structurées
    const files: { name: string; content: unknown }[] = [
      { name: 'donnees/cabinet.json', content: data.cabinet },
      { name: 'donnees/membres.json', content: data.members },
      { name: 'donnees/conformite.json', content: data.complianceAnswers },
      { name: 'donnees/contacts.json', content: data.contacts },
      { name: 'donnees/interactions.json', content: data.interactions },
      { name: 'donnees/fournisseurs.json', content: data.suppliers },
      { name: 'donnees/produits.json', content: data.products },
      { name: 'donnees/formations.json', content: data.trainings },
      { name: 'donnees/partages.json', content: data.shares },
      { name: 'donnees/consentements.json', content: data.consentRecords },
    ]

    for (const file of files) {
      archive.append(Buffer.from(serialize(file.content), 'utf-8'), { name: file.name })
    }

    // Documents hébergés — avec arborescence dossiers
    const hosted = data.documents.filter((d) => d.storageMode === 'hosted' && d.storagePath)

    let chain = Promise.resolve()
    for (const doc of hosted) {
      chain = chain.then(async () => {
        try {
          const stream = await minioNative.getObject(BUCKET, doc.storagePath!)
          const folderPath = doc.folderId ? (data.foldersMap.get(doc.folderId) ?? '') : ''
          const safeName = doc.name.replace(/[/\\]/g, '_')
          const entryPath = folderPath ? `documents/${folderPath}/${safeName}` : `documents/${safeName}`
          archive.append(stream as unknown as Readable, { name: entryPath })
        } catch {
          console.warn(`[gdpr-export] Fichier ignoré: ${doc.storagePath}`)
        }
      })
    }

    chain.then(() => archive.finalize()).catch(reject)
  })
}

// ── Collecte complète ────────────────────────────────────────────────────────

async function collectAllCabinetData(cabinetId: string) {
  const [
    cabinet,
    members,
    contacts,
    interactions,
    documents,
    suppliers,
    products,
    trainings,
    shares,
    consentRecords,
    complianceAnswers,
    folders,
  ] = await Promise.all([
    prisma.cabinet.findUnique({ where: { id: cabinetId } }),

    prisma.cabinetMember.findMany({
      where: { cabinetId, deletedAt: null },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, globalRole: true } } },
    }),

    prisma.contact.findMany({
      where: { cabinetId, deletedAt: null },
      orderBy: { lastName: 'asc' },
    }),

    prisma.interaction.findMany({
      where: { contact: { cabinetId } },
      orderBy: { occurredAt: 'desc' },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),

    prisma.document.findMany({
      where: { cabinetId, deletedAt: null },
      include: {
        folder: { select: { id: true, name: true } },
        tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    }),

    prisma.cabinetSupplier.findMany({
      where: { cabinetId },
      include: { supplier: { select: { id: true, name: true, category: true, website: true } } },
    }),

    prisma.cabinetProduct.findMany({
      where: { cabinetId },
      include: { product: { select: { id: true, name: true, category: true } } },
    }),

    prisma.collaboratorTraining.findMany({
      where: { cabinetId, deletedAt: null },
      include: {
        training: { select: { id: true, name: true, organizer: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),

    prisma.share.findMany({
      where: { cabinetId },
      orderBy: { createdAt: 'desc' },
    }),

    // Consentements de tous les membres du cabinet
    prisma.consentRecord.findMany({
      where: { user: { cabinetMembers: { some: { cabinetId } } } },
      orderBy: { acceptedAt: 'desc' },
      include: { user: { select: { id: true, email: true } } },
    }),

    prisma.cabinetComplianceAnswer.findMany({
      where: { cabinetId, deletedAt: null },
      include: { item: { select: { id: true, label: true, type: true, phase: { select: { label: true } } } } },
    }),

    prisma.folder.findMany({
      where: { cabinetId },
      select: { id: true, name: true, parentId: true },
    }),
  ])

  const foldersMap = buildFoldersMap(folders)

  return {
    cabinet,
    members,
    contacts,
    interactions,
    documents,
    suppliers,
    products,
    trainings,
    shares,
    consentRecords,
    complianceAnswers,
    folders,
    foldersMap,
  }
}

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
