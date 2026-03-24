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

// ── Template RGPD — notification admin ───────────────────────────────────────

export async function sendGdprRequestAdminEmail(params: {
  cabinetName: string
  cabinetId: string
  type: 'ACCESS' | 'ERASURE'
  message?: string | null
  requestId: string
}): Promise<void> {
  const { cabinetName, cabinetId, type, message, requestId } = params
  const adminUrl = `${process.env.FRONTEND_URL}/admin/rgpd`
  const typeLabel = type === 'ACCESS' ? "Droit d'accès" : "Droit à l'effacement"
  const subject = `[RGPD] Nouvelle demande ${typeLabel} — ${cabinetName}`

  const html = `
    <p>Bonjour,</p>
    <p>
      Le cabinet <strong>${cabinetName}</strong> (id: <code>${cabinetId}</code>)
      a soumis une demande RGPD de type <strong>${typeLabel}</strong>.
    </p>
    ${message ? `<p><strong>Message :</strong> ${message}</p>` : ''}
    <p>ID de la demande : <code>${requestId}</code></p>
    <p style="margin-top:24px">
      <a href="${adminUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
        Traiter la demande
      </a>
    </p>
    <p>— CGP Platform</p>
  `

  const to = process.env.GDPR_ADMIN_EMAIL
  if (!to) return
  await sendEmail({ to, subject, html })
}

// ── Template RGPD — confirmation cabinet ─────────────────────────────────────

export async function sendGdprRequestConfirmEmail(params: {
  to: string
  cabinetName: string
  type: 'ACCESS' | 'ERASURE'
  status: 'DONE' | 'REJECTED'
  response?: string | null
  downloadUrl?: string | null
}): Promise<void> {
  const { to, cabinetName, type, status, response, downloadUrl } = params
  const typeLabel = type === 'ACCESS' ? "Droit d'accès" : "Droit à l'effacement"
  const subject = status === 'DONE'
    ? `[RGPD] Demande ${typeLabel} traitée — ${cabinetName}`
    : `[RGPD] Demande ${typeLabel} refusée — ${cabinetName}`

  const html = `
    <p>Bonjour,</p>
    <p>
      Votre demande RGPD de type <strong>${typeLabel}</strong>
      pour le cabinet <strong>${cabinetName}</strong>
      a été <strong>${status === 'DONE' ? 'traitée' : 'refusée'}</strong>.
    </p>
    ${response ? `<p><strong>Note :</strong> ${response}</p>` : ''}
    ${downloadUrl ? `
      <p style="margin-top:16px">
        <a href="${downloadUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
          Télécharger vos données (lien valable 7 jours)
        </a>
      </p>
    ` : ''}
    <p>— CGP Platform</p>
  `

  await sendEmail({ to, subject, html })
}
