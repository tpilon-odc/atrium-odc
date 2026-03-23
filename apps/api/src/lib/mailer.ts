import nodemailer from 'nodemailer'
import { Resend } from 'resend'

const FROM = process.env.MAIL_FROM || 'CGP Platform <noreply@cgp-platform.fr>'
const isProd = process.env.NODE_ENV === 'production'

// ── Transport SMTP (dev → Mailpit) ────────────────────────────────────────────
const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
})

// ── Resend (prod) ─────────────────────────────────────────────────────────────
const resend = isProd && process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// ── Envoi unifié ─────────────────────────────────────────────────────────────
async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (resend) {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
    if (error) throw new Error(`Resend error: ${error.message}`)
  } else {
    await smtpTransport.sendMail({ from: FROM, ...params })
  }
}

// ── Template conformité ───────────────────────────────────────────────────────

export async function sendComplianceExpiryEmail(params: {
  to: string
  cabinetName: string
  itemLabel: string
  phaseLabel: string
  expiresAt: Date
  daysBefore: number
}): Promise<void> {
  const { to, cabinetName, itemLabel, phaseLabel, expiresAt, daysBefore } = params

  const formattedDate = expiresAt.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const isExpired = daysBefore === 0
  const subject = isExpired
    ? `🔴 ${itemLabel} a expiré — Action requise — Cabinet ${cabinetName}`
    : `⚠️ ${itemLabel} expire dans ${daysBefore} jour${daysBefore > 1 ? 's' : ''} — Cabinet ${cabinetName}`

  const ctaUrl = `${process.env.FRONTEND_URL}/conformite`
  const html = isExpired
    ? `
      <p>Bonjour,</p>
      <p>
        L'item de conformité <strong>${itemLabel}</strong> (phase : ${phaseLabel})
        du cabinet <strong>${cabinetName}</strong> a <strong>expiré</strong>.
      </p>
      <p>Veuillez le renouveler dès que possible.</p>
      <p style="margin-top:24px">
        <a href="${ctaUrl}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
          Renouveler maintenant
        </a>
      </p>
      <p>— CGP Platform</p>
    `
    : `
      <p>Bonjour,</p>
      <p>
        L'item de conformité <strong>${itemLabel}</strong> (phase : ${phaseLabel})
        du cabinet <strong>${cabinetName}</strong>
        expire le <strong>${formattedDate}</strong> (dans ${daysBefore} jour${daysBefore > 1 ? 's' : ''}).
      </p>
      <p>Pensez à le renouveler avant cette date.</p>
      <p style="margin-top:24px">
        <a href="${ctaUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
          Mettre à jour maintenant
        </a>
      </p>
      <p>— CGP Platform</p>
    `

  await sendEmail({ to, subject, html })
}
