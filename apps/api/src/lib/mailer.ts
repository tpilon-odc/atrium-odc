import nodemailer from 'nodemailer'

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
})

export async function sendComplianceExpiryEmail(params: {
  to: string
  cabinetName: string
  itemLabel: string
  expiresAt: Date
  daysBefore: number
}): Promise<void> {
  const { to, cabinetName, itemLabel, expiresAt, daysBefore } = params

  const formattedDate = expiresAt.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  await mailer.sendMail({
    from: process.env.MAIL_FROM || 'cgp-platform@localhost',
    to,
    subject: `[CGP Platform] Expiration dans ${daysBefore} jour(s) — ${itemLabel}`,
    html: `
      <p>Bonjour,</p>
      <p>
        L'item de conformité <strong>${itemLabel}</strong> du cabinet <strong>${cabinetName}</strong>
        expire le <strong>${formattedDate}</strong> (dans ${daysBefore} jour(s)).
      </p>
      <p>Merci de le renouveler avant cette date.</p>
      <p>— CGP Platform</p>
    `,
  })
}
