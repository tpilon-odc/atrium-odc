import { prisma } from '../lib/prisma'
import { minioNative, BUCKET } from '../lib/minio'
import { sendGdprRequestConfirmEmail } from '../lib/mailer'

const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID ?? '00000000-0000-0000-0000-000000000001'

/**
 * Job — traite les GdprRequest ERASURE en statut PROCESSING.
 *
 * Cascade en 6 étapes (dans une transaction où possible) :
 *  1. Suppression physique des données privées du cabinet
 *  2. Suppression fichiers MinIO cabinets/{cabinet_id}/
 *  3. Anonymisation données communautaires (created_by → SYSTEM_USER_ID)
 *  4. Anonymisation users : email anonyme · is_active=false · gdpr_anonymized_at
 *  5. Cabinet : subscription_status=cancelled · deletion_scheduled_at=now()
 *  6. GdprRequest : status=DONE + email de confirmation
 *
 * Note : consent_records conservés (obligation légale de preuve).
 *
 * Appelé par cron toutes les 5 minutes depuis index.ts.
 */
export async function runGdprErasureJob(): Promise<void> {
  const requests = await prisma.gdprRequest.findMany({
    where: { type: 'ERASURE', status: 'PROCESSING' },
    orderBy: { createdAt: 'asc' },
    take: 1, // Effacement lourd — 1 à la fois
    include: {
      cabinet: { select: { id: true, name: true } },
      requester: { select: { email: true } },
    },
  })

  if (!requests.length) return

  for (const req of requests) {
    const cabinetId = req.cabinetId
    console.log(`[gdpr-erasure] Début effacement cabinet ${cabinetId}`)

    try {
      // ── Étape 1 : suppression physique données privées ──────────────────────
      // Pré-calcul des IDs clusters/channels pour les messages (hors transaction)
      const clusterIds = (await prisma.clusterMember.findMany({
        where: { cabinetId },
        select: { clusterId: true },
      })).map((c) => c.clusterId)

      const channelIds = clusterIds.length > 0
        ? (await prisma.channel.findMany({
            where: { clusterId: { in: clusterIds } },
            select: { id: true },
          })).map((c) => c.id)
        : []

      await prisma.$transaction(async (tx) => {
        // Supprime dans l'ordre inverse des dépendances FK
        await tx.messageReaction.deleteMany({ where: { cabinetId } })
        if (channelIds.length > 0) {
          await tx.messageReport.deleteMany({ where: { message: { channelId: { in: channelIds } } } })
        }

        await tx.notification.deleteMany({ where: { cabinetId } })
        await tx.share.deleteMany({ where: { cabinetId } })
        await tx.collaboratorTraining.deleteMany({ where: { cabinetId } })
        await tx.event.deleteMany({ where: { cabinetId } })
        await tx.interaction.deleteMany({ where: { contact: { cabinetId } } })
        await tx.contact.deleteMany({ where: { cabinetId } })
        await tx.cabinetComplianceAnswer.deleteMany({ where: { cabinetId } })
        await tx.cabinetSupplier.deleteMany({ where: { cabinetId } })
        await tx.cabinetProduct.deleteMany({ where: { cabinetId } })
        await tx.cabinetTool.deleteMany({ where: { cabinetId } })
        await tx.exportJob.deleteMany({ where: { cabinetId } })
        await tx.documentTag.deleteMany({ where: { document: { cabinetId } } })
        await tx.document.deleteMany({ where: { cabinetId } })
        await tx.folder.deleteMany({ where: { cabinetId } })
        await tx.tag.deleteMany({ where: { cabinetId } })
      }, { timeout: 30_000 })

      console.log(`[gdpr-erasure] Étape 1 OK — données privées supprimées`)

      // ── Étape 2 : suppression fichiers MinIO ────────────────────────────────
      try {
        const prefix = `cabinets/${cabinetId}/`
        const objects: string[] = []

        await new Promise<void>((resolve, reject) => {
          const stream = minioNative.listObjects(BUCKET, prefix, true)
          stream.on('data', (obj) => { if (obj.name) objects.push(obj.name) })
          stream.on('end', resolve)
          stream.on('error', reject)
        })

        if (objects.length > 0) {
          await minioNative.removeObjects(BUCKET, objects)
          console.log(`[gdpr-erasure] Étape 2 OK — ${objects.length} fichiers MinIO supprimés`)
        }
      } catch (minioErr) {
        // Non bloquant — le reste de l'effacement continue
        console.error(`[gdpr-erasure] Erreur MinIO (non bloquant):`, minioErr)
      }

      // ── Étape 3 : anonymisation données communautaires ──────────────────────
      // Réattribue les créations communautaires au user système
      const memberIds = (await prisma.cabinetMember.findMany({
        where: { cabinetId },
        select: { userId: true },
      })).map((m) => m.userId).filter((id): id is string => id !== null)

      if (memberIds.length > 0) {
        await prisma.$transaction([
          prisma.supplier.updateMany({
            where: { createdBy: { in: memberIds } },
            data: { createdBy: SYSTEM_USER_ID },
          }),
          prisma.product.updateMany({
            where: { createdBy: { in: memberIds } },
            data: { createdBy: SYSTEM_USER_ID },
          }),
          prisma.tool.updateMany({
            where: { createdBy: { in: memberIds } },
            data: { createdBy: SYSTEM_USER_ID },
          }),
          prisma.trainingCatalog.updateMany({
            where: { createdBy: { in: memberIds } },
            data: { createdBy: SYSTEM_USER_ID },
          }),
        ])
      }
      console.log(`[gdpr-erasure] Étape 3 OK — données communautaires réattribuées`)

      // ── Étape 4 : anonymisation users du cabinet ────────────────────────────
      // Conserve consent_records (obligation légale)
      await prisma.$transaction(async (tx) => {
        for (const userId of memberIds) {
          await tx.user.update({
            where: { id: userId },
            data: {
              email: `anonyme_${userId}@supprime.cgp`,
              firstName: null,
              lastName: null,
              avatarUrl: null,
              isActive: false,
              gdprAnonymizedAt: new Date(),
            },
          })
        }

        // Supprimer les memberships cabinet
        await tx.cabinetMember.deleteMany({ where: { cabinetId } })
      })
      console.log(`[gdpr-erasure] Étape 4 OK — users anonymisés`)

      // ── Étape 5 : cabinet marqué supprimé ───────────────────────────────────
      await prisma.cabinet.update({
        where: { id: cabinetId },
        data: {
          subscriptionStatus: 'cancelled',
          deletionScheduledAt: new Date(),
        },
      })
      console.log(`[gdpr-erasure] Étape 5 OK — cabinet marqué pour suppression définitive`)

      // ── Étape 6 : finalisation demande + email ───────────────────────────────
      await prisma.gdprRequest.update({
        where: { id: req.id },
        data: { status: 'DONE', processedAt: new Date() },
      })

      sendGdprRequestConfirmEmail({
        to: req.requester.email,
        cabinetName: req.cabinet.name,
        type: 'ERASURE',
        status: 'DONE',
      }).catch(() => { /* non bloquant */ })

      console.log(`[gdpr-erasure] Effacement cabinet ${cabinetId} terminé`)
    } catch (err) {
      console.error(`[gdpr-erasure] Erreur pour demande ${req.id}:`, err)
      // Remettre en PENDING pour retry (ne pas bloquer définitivement)
      await prisma.gdprRequest.update({
        where: { id: req.id },
        data: {
          status: 'PENDING',
          response: `Erreur : ${err instanceof Error ? err.message : String(err)}`,
        },
      }).catch(() => { /* ignore */ })
    }
  }
}

/**
 * Cron purge définitive — supprime physiquement les cabinets effacés
 * depuis plus de 30 jours (deletion_scheduled_at + 30j).
 * Appelé quotidiennement depuis index.ts.
 */
export async function runGdprPurgeFinalJob(): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const toDelete = await prisma.cabinet.findMany({
    where: { deletionScheduledAt: { lte: cutoff } },
    select: { id: true, name: true },
  })

  if (!toDelete.length) return

  for (const cabinet of toDelete) {
    try {
      // Supprime auth Supabase users (les users sont déjà anonymisés)
      // On supprime juste l'enregistrement cabinet (consent_records conservés via FK sur users)
      await prisma.cabinet.delete({ where: { id: cabinet.id } })
      console.log(`[gdpr-purge] Cabinet ${cabinet.id} (${cabinet.name}) purgé définitivement`)
    } catch (err) {
      console.error(`[gdpr-purge] Erreur pour cabinet ${cabinet.id}:`, err)
    }
  }
}
