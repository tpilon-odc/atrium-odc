import { prisma } from '../lib/prisma'
import { sendComplianceExpiryEmail } from '../lib/mailer'

/**
 * Job nuit à 6h UTC — envoie les notifications d'expiration conformité.
 * Logique :
 * - Récupère toutes les réponses soumises avec expiresAt futur
 * - Pour chaque seuil dans item.alertBeforeDays, vérifie si expiresAt = today + N jours
 * - Évite les doublons via compliance_notifications (même answerId + daysBefore dans les 24h)
 */
export async function runComplianceNotificationsJob(): Promise<void> {
  const now = new Date()

  // Answers soumises, non expirées, avec expiresAt défini
  const answers = await prisma.cabinetComplianceAnswer.findMany({
    where: {
      status: 'submitted',
      expiresAt: { gt: now },
      deletedAt: null,
    },
    include: {
      item: { select: { label: true, alertBeforeDays: true } },
      cabinet: {
        select: {
          name: true,
          members: {
            where: { role: 'owner', leftAt: null },
            include: { user: { select: { email: true } } },
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
      // Vérifie si expiresAt tombe dans la fenêtre today+N (± 12h pour absorber les décalages)
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

      // Récupère l'email de l'owner du cabinet
      const ownerMember = answer.cabinet.members[0]
      if (!ownerMember?.user?.email) continue

      try {
        await sendComplianceExpiryEmail({
          to: ownerMember.user.email,
          cabinetName: answer.cabinet.name,
          itemLabel: answer.item.label,
          expiresAt: answer.expiresAt,
          daysBefore,
        })

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
        console.error(`[compliance-notifications] Erreur envoi pour answer ${answer.id}:`, err)
      }
    }
  }

  console.log(`[compliance-notifications] Terminé — ${sent} envoyés, ${skipped} ignorés (doublons)`)
}
