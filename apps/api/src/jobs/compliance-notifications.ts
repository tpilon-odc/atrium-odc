import { prisma } from '../lib/prisma'
import { sendComplianceExpiryEmail } from '../lib/mailer'

/**
 * Job nuit à 6h UTC — envoie les notifications d'expiration conformité.
 * Logique :
 * - Récupère toutes les réponses soumises avec expiresAt défini
 * - Pour chaque seuil dans item.alertBeforeDays, vérifie si expiresAt = today + N jours (±12h)
 * - Évite les doublons via compliance_notifications (même answerId + daysBefore dans les 24h)
 * - Crée une notification in-app ET envoie un email pour chaque owner/admin du cabinet
 */
export async function runComplianceNotificationsJob(): Promise<void> {
  const now = new Date()

  // Answers soumises avec expiresAt défini (y compris expirées pour les alertes J=0)
  const answers = await prisma.cabinetComplianceAnswer.findMany({
    where: {
      status: 'submitted',
      expiresAt: { not: null },
      deletedAt: null,
    },
    include: {
      item: {
        select: {
          label: true,
          alertBeforeDays: true,
          phaseId: true,
          phase: { select: { label: true } },
        },
      },
      cabinet: {
        select: {
          id: true,
          name: true,
          members: {
            where: {
              role: { in: ['owner', 'admin'] },
              deletedAt: null,
            },
            include: {
              user: { select: { id: true, email: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  })

  let sent = 0
  let skipped = 0

  for (const answer of answers) {
    const alertDays = answer.item.alertBeforeDays
    if (!alertDays.length || !answer.expiresAt) continue

    for (const daysBefore of alertDays) {
      const target = new Date(now)
      target.setDate(target.getDate() + daysBefore)

      const diffMs = Math.abs(answer.expiresAt.getTime() - target.getTime())
      const diffHours = diffMs / (1000 * 60 * 60)
      if (diffHours > 12) continue

      // Anti-doublon : notification déjà envoyée dans les 24h ?
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const existing = await prisma.complianceNotification.findFirst({
        where: {
          answerId: answer.id,
          daysBefore,
          sentAt: { gt: cutoff },
        },
      })

      if (existing) {
        skipped++
        continue
      }

      const isExpired = daysBefore === 0
      const type = isExpired ? 'compliance_expired' : 'compliance_expiring'
      const title = isExpired
        ? `${answer.item.label} a expiré`
        : `${answer.item.label} expire dans ${daysBefore} jour${daysBefore > 1 ? 's' : ''}`
      const message = isExpired
        ? `L'item "${answer.item.label}" (${answer.item.phase.label}) a expiré. Renouvelez-le dès que possible.`
        : `L'item "${answer.item.label}" (${answer.item.phase.label}) expire le ${answer.expiresAt.toLocaleDateString('fr-FR')}. Pensez à le renouveler.`

      const recipients = answer.cabinet.members
      if (!recipients.length) continue

      try {
        // Crée une notification in-app pour chaque owner/admin
        await prisma.notification.createMany({
          data: recipients.map((m) => ({
            cabinetId: answer.cabinetId,
            userId: m.user.id,
            type,
            title,
            message,
            entityType: 'compliance_phase',
            entityId: answer.item.phaseId,
          })),
          skipDuplicates: true,
        })

        // Envoie un email à chaque owner/admin — envoi parallèle
        await Promise.all(recipients.map((member) =>
          sendComplianceExpiryEmail({
            to: member.user.email,
            cabinetName: answer.cabinet.name,
            itemLabel: answer.item.label,
            phaseLabel: answer.item.phase.label,
            expiresAt: answer.expiresAt,
            daysBefore,
          })
        ))

        // Trace l'envoi dans compliance_notifications
        await prisma.complianceNotification.create({
          data: {
            cabinetId: answer.cabinetId,
            answerId: answer.id,
            daysBefore,
            channel: 'email',
            sentAt: now,
          },
        })

        sent++
      } catch (err) {
        console.error(`[compliance-notifications] Erreur pour answer ${answer.id}:`, err)
      }
    }
  }

  console.log(`[compliance-notifications] Terminé — ${sent} envoyés, ${skipped} ignorés (doublons)`)
}
