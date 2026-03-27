import { prisma } from '../lib/prisma'
import { sendSupplierReviewEmail } from '../lib/mailer'

/**
 * Job nuit à 6h05 UTC — alerte les cabinets dont une révision annuelle fournisseur est due dans 30j.
 */
export async function runSupplierReviewNotificationsJob(): Promise<void> {
  const now = new Date()
  const in30days = new Date(now)
  in30days.setDate(in30days.getDate() + 30)

  const evaluations = await prisma.cabinetSupplierEvaluation.findMany({
    where: {
      status: 'completed',
      nextReviewDate: { lte: in30days, not: null },
    },
    include: {
      supplier: { select: { id: true, name: true } },
      cabinet: {
        select: {
          id: true,
          name: true,
          members: {
            where: { role: { in: ['owner', 'admin'] }, deletedAt: null },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          },
        },
      },
    },
  })

  let sent = 0
  let skipped = 0

  for (const evaluation of evaluations) {
    if (!evaluation.nextReviewDate) continue

    const daysLeft = Math.ceil(
      (evaluation.nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Seuils d'alerte : J-30, J-14, J-7, J-0
    const thresholds = [30, 14, 7, 0]
    for (const threshold of thresholds) {
      if (daysLeft > threshold) continue

      // Anti-doublon : notification déjà créée pour cet eval + seuil dans les 24h ?
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const alreadyNotified = await prisma.notification.findFirst({
        where: {
          cabinetId: evaluation.cabinetId,
          entityType: 'supplier_evaluation',
          entityId: evaluation.id,
          type: `supplier_review_due_${threshold}`,
          createdAt: { gt: cutoff },
        },
      })

      if (alreadyNotified) { skipped++; continue }

      const isOverdue = daysLeft <= 0
      const title = isOverdue
        ? `Révision fournisseur en retard : ${evaluation.supplier.name}`
        : `Révision fournisseur due dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} : ${evaluation.supplier.name}`
      const message = isOverdue
        ? `La révision annuelle de ${evaluation.supplier.name} était prévue le ${evaluation.nextReviewDate.toLocaleDateString('fr-FR')}. Veuillez la réaliser dès que possible.`
        : `La révision annuelle de ${evaluation.supplier.name} est due le ${evaluation.nextReviewDate.toLocaleDateString('fr-FR')}.`

      const recipients = evaluation.cabinet.members
      if (!recipients.length) continue

      try {
        // Notifications in-app
        await prisma.notification.createMany({
          data: recipients.map((m) => ({
            cabinetId: evaluation.cabinetId,
            userId: m.user.id,
            type: `supplier_review_due_${threshold}`,
            title,
            message,
            entityType: 'supplier_evaluation',
            entityId: evaluation.id,
          })),
          skipDuplicates: true,
        })

        // Emails
        for (const member of recipients) {
          await sendSupplierReviewEmail({
            to: member.user.email,
            supplierName: evaluation.supplier.name,
            cabinetName: evaluation.cabinet.name,
            nextReviewDate: evaluation.nextReviewDate,
            daysLeft,
            supplierUrl: `${process.env.FRONTEND_URL}/fournisseurs/${evaluation.supplierId}`,
          })
        }

        sent++
      } catch (err) {
        console.error(`[supplier-review-notifications] Erreur pour évaluation ${evaluation.id}:`, err)
      }
    }
  }

  console.log(`[supplier-review-notifications] Terminé — ${sent} envoyés, ${skipped} ignorés (doublons)`)
}
