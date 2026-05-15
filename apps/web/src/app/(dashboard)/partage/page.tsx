'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Share2, Trash2, Plus, X, ArrowUpRight, ArrowDownLeft, Eye, EyeOff, Activity, GraduationCap, FileText, CheckCircle2, AlertTriangle, XCircle, Circle, Building2, ShieldCheck, User, ExternalLink, Folder, ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { shareApi, complianceShareApi, type Share, type ShareWithViewLog, type Document, type ComplianceShareCabinet } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { DocumentViewer } from '@/components/ui/DocumentViewer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const ENTITY_LABELS: Record<string, string> = {
  contact: 'Contact',
  document: 'Document',
  collaborator_training: 'Formation',
  cabinet_compliance: 'Conformité cabinet',
  cabinet: 'Cabinet complet',
  compliance_item: 'Item de conformité',
}

// ── Conformité partagée ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  submitted:     { label: 'Conforme',       icon: CheckCircle2,  className: 'text-green-600' },
  expiring_soon: { label: 'Expire bientôt', icon: AlertTriangle, className: 'text-amber-500' },
  expired:       { label: 'Expiré',         icon: XCircle,       className: 'text-red-500' },
  not_started:   { label: 'Non renseigné',  icon: Circle,        className: 'text-muted-foreground/40' },
  draft:         { label: 'Brouillon',      icon: Circle,        className: 'text-muted-foreground/40' },
}

function ComplianceItemRow({ item: shared }: { item: ComplianceShareCabinet['items'][0] }) {
  const cfg = STATUS_CONFIG[shared.status] ?? STATUS_CONFIG.not_started
  const Icon = cfg.icon
  const [viewing, setViewing] = useState(false)

  const doc = shared.answer?.document ?? null
  const docAsDocument: Document | null = doc
    ? { id: doc.id, name: doc.name, mimeType: (doc as { mimeType?: string | null }).mimeType ?? null, description: null, storageMode: 'hosted', sizeBytes: null, folderId: null, createdAt: '', links: [], tags: [] }
    : null

  const answerText = shared.item.type === 'text'
    ? (shared.answer?.value as { text?: string })?.text
    : shared.item.type !== 'doc'
      ? (Array.isArray((shared.answer?.value as { selected?: unknown })?.selected) ? ((shared.answer?.value as { selected: string[] }).selected).join(', ') : null)
      : null

  return (
    <>
      {viewing && docAsDocument && <DocumentViewer document={docAsDocument} onClose={() => setViewing(false)} shared />}
      <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
        <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', cfg.className)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{shared.item.label}</p>
          <p className="text-xs text-muted-foreground">{shared.item.phase.label}</p>
          {docAsDocument && (
            <button onClick={() => setViewing(true)} className="mt-1.5 flex items-center gap-1.5 text-xs text-primary hover:underline">
              <FileText className="h-3.5 w-3.5" />
              {docAsDocument.name}
              <Eye className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {answerText && <p className="mt-1 text-xs text-foreground/70 line-clamp-2">{answerText}</p>}
        </div>
        <div className="text-right shrink-0">
          <span className={cn('text-xs font-medium', cfg.className)}>{cfg.label}</span>
          {shared.answer?.expiresAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Expire le {new Date(shared.answer.expiresAt).toLocaleDateString('fr-FR')}</p>
          )}
          {shared.answer?.submittedAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Soumis le {new Date(shared.answer.submittedAt).toLocaleDateString('fr-FR')}</p>
          )}
        </div>
      </div>
    </>
  )
}

function CabinetComplianceCard({ entry }: { entry: ComplianceShareCabinet }) {
  const { cabinet, items } = entry
  const [open, setOpen] = useState(false)
  const submitted = items.filter((i) => i.status === 'submitted' || i.status === 'expiring_soon').length
  const total = items.length
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-left">
            <p className="font-medium text-sm">{cabinet.name}</p>
            {cabinet.oriasNumber && <p className="text-xs text-muted-foreground">ORIAS : {cabinet.oriasNumber}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{pct}%</p>
            <p className="text-[10px] text-muted-foreground">{submitted}/{total} conforme{submitted > 1 ? 's' : ''}</p>
          </div>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      <div className="h-1 bg-muted">
        <div
          className={cn('h-full transition-all', pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-primary' : 'bg-amber-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {open && (
        <div className="px-5 py-1">
          {items.map((item) => <ComplianceItemRow key={item.shareId} item={item} />)}
        </div>
      )}
    </div>
  )
}

// ── Partages ──────────────────────────────────────────────────────────────────

function ShareRow({ share, onRevoke, inFolder = false }: { share: Share; onRevoke?: () => void; inFolder?: boolean }) {
  const { token } = useAuthStore()
  const [viewingCert, setViewingCert] = useState(false)
  const [viewingDoc, setViewingDoc] = useState(false)
  const who = share.recipientUser?.email ?? share.granterUser?.email ?? '—'
  const cabinetName = share.cabinet?.name
  const training = share.resolvedTraining ?? null
  const contact = share.resolvedContact ?? null
  const resolvedDoc = share.resolvedDocument ?? null

  const cert = training?.certificate ?? null
  const certAsDoc: Document | null = cert
    ? { id: cert.id, name: cert.name, mimeType: cert.mimeType ?? null, description: null, storageMode: 'hosted', sizeBytes: null, folderId: null, createdAt: '', links: [], tags: [] }
    : null

  const sharedDocAsDoc: Document | null = resolvedDoc
    ? { id: resolvedDoc.id, name: resolvedDoc.name, mimeType: resolvedDoc.mimeType ?? null, description: null, storageMode: (resolvedDoc.storageMode ?? 'hosted') as 'hosted' | 'external', sizeBytes: resolvedDoc.sizeBytes ?? null, folderId: resolvedDoc.folder?.id ?? null, createdAt: '', links: [], tags: [] }
    : null

  const contactName = contact
    ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || '—'
    : null

  return (
    <>
      {viewingCert && certAsDoc && <DocumentViewer document={certAsDoc} onClose={() => setViewingCert(false)} />}
      {viewingDoc && sharedDocAsDoc && <DocumentViewer document={sharedDocAsDoc} onClose={() => setViewingDoc(false)} shared />}
      <div className={cn('flex items-start gap-4 px-4 py-3 group', inFolder ? 'bg-transparent' : 'bg-card border border-border rounded-lg')}>
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
          {training ? <GraduationCap className="h-4 w-4 text-muted-foreground" /> : sharedDocAsDoc ? <FileText className="h-4 w-4 text-muted-foreground" /> : contact ? <User className="h-4 w-4 text-muted-foreground" /> : <Share2 className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {training ? training.training.name : sharedDocAsDoc ? sharedDocAsDoc.name : contact ? contactName : (ENTITY_LABELS[share.entityType] ?? share.entityType)}
          </p>
          {training && (
            <p className="text-xs text-muted-foreground">
              {[training.user?.firstName, training.user?.lastName].filter(Boolean).join(' ') || training.user?.email}
              {' · '}{new Date(training.trainingDate).toLocaleDateString('fr-FR')}
              {training.trainingDateEnd ? ` → ${new Date(training.trainingDateEnd).toLocaleDateString('fr-FR')}` : ''}
              {training.hoursCompleted ? ` · ${training.hoursCompleted}h` : ''}
            </p>
          )}
          {contact && (
            <p className="text-xs text-muted-foreground capitalize">{contact.type}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {cabinetName ? `De : ${cabinetName} (${who})` : `Avec : ${who}`}
            {' · '}{new Date(share.createdAt).toLocaleDateString('fr-FR')}
          </p>
          {sharedDocAsDoc && (
            <button onClick={() => { setViewingDoc(true); if (token) shareApi.recordView(share.id, token).catch(() => {}) }} className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
              <Eye className="h-3 w-3" />
              Ouvrir le document
            </button>
          )}
          {certAsDoc && (
            <button onClick={() => setViewingCert(true)} className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline">
              <FileText className="h-3 w-3" />
              {certAsDoc.name}
            </button>
          )}
          {contact && share.entityId && (
            <Link
              href={`/crm/${share.entityId}?shared=1`}
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Consulter le dossier
            </Link>
          )}
        </div>
        {onRevoke && (
          <button
            onClick={onRevoke}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </>
  )
}

function GrantedList({ shares, onRevoke }: { shares: Share[]; onRevoke: (id: string) => void }) {
  // Group by recipient user
  const recipientMap = new Map<string, { email: string; shares: Share[] }>()
  for (const share of shares) {
    const recipientId = share.grantedTo
    const email = share.recipientUser?.email ?? recipientId
    if (!recipientMap.has(recipientId)) recipientMap.set(recipientId, { email, shares: [] })
    recipientMap.get(recipientId)!.shares.push(share)
  }

  return (
    <div className="space-y-2">
      {Array.from(recipientMap.entries()).map(([recipientId, { email, shares: rShares }]) => (
        <RecipientGrantedGroup key={recipientId} recipientId={recipientId} email={email} shares={rShares} onRevoke={onRevoke} />
      ))}
    </div>
  )
}

function RecipientGrantedGroup({ recipientId, email, shares, onRevoke }: { recipientId: string; email: string; shares: Share[]; onRevoke: (id: string) => void }) {
  const [open, toggle] = usePersistedToggle(`granted:${recipientId}`)

  const complianceShares = shares.filter((s) => s.entityType === 'compliance_item')
  const trainingShares = shares.filter((s) => s.entityType === 'collaborator_training')
  const contactShares = shares.filter((s) => s.entityType === 'contact')
  const docSharesWithFolder = shares.filter((s) => s.entityType !== 'compliance_item' && s.entityType !== 'collaborator_training' && s.entityType !== 'contact' && !!s.resolvedDocument?.folder)
  const folderMap = new Map<string, { name: string; shares: Share[] }>()
  for (const share of docSharesWithFolder) {
    const folder = share.resolvedDocument?.folder
    if (!folder) continue
    const folderId = folder.id
    if (!folderMap.has(folderId)) folderMap.set(folderId, { name: folder.name, shares: [] })
    folderMap.get(folderId)!.shares.push(share)
  }
  const otherShares = shares.filter(
    (s) => s.entityType !== 'compliance_item' && s.entityType !== 'collaborator_training' && s.entityType !== 'contact' && !s.resolvedDocument?.folder
  )

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/50 transition-colors">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1 text-left">{email}</span>
        <span className="text-xs text-muted-foreground">{shares.length} élément{shares.length > 1 ? 's' : ''}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border">
          {complianceShares.length > 0 && (
            <SubGroup label="Conformité" count={complianceShares.length} storageKey={`granted:${recipientId}:compliance`}>
              {complianceShares.map((s) => <GrantedShareRow key={s.id} share={s} onRevoke={() => onRevoke(s.id)} />)}
            </SubGroup>
          )}
          {trainingShares.length > 0 && (
            <SubGroup label="Formations" count={trainingShares.length} storageKey={`granted:${recipientId}:trainings`}>
              {trainingShares.map((s) => <GrantedShareRow key={s.id} share={s} onRevoke={() => onRevoke(s.id)} />)}
            </SubGroup>
          )}
          {contactShares.length > 0 && (
            <SubGroup label="Contacts" count={contactShares.length} icon={<User className="h-3.5 w-3.5 text-muted-foreground" />} storageKey={`granted:${recipientId}:contacts`}>
              {contactShares.map((s) => <GrantedShareRow key={s.id} share={s} onRevoke={() => onRevoke(s.id)} />)}
            </SubGroup>
          )}
          {Array.from(folderMap.entries()).map(([folderId, { name, shares: fShares }]) => (
            <SubGroup key={folderId} label={name} count={fShares.length} icon={<Folder className="h-3.5 w-3.5 text-amber-500" />} storageKey={`granted:${recipientId}:folder:${folderId}`}>
              {fShares.map((s) => <GrantedShareRow key={s.id} share={s} onRevoke={() => onRevoke(s.id)} />)}
            </SubGroup>
          ))}
          {otherShares.map((s) => (
            <div key={s.id} className="border-t border-border first:border-0">
              <GrantedShareRow share={s} onRevoke={() => onRevoke(s.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GrantedShareRow({ share, onRevoke }: { share: Share; onRevoke: () => void }) {
  const training = share.resolvedTraining
  const contact = share.resolvedContact
  const doc = share.resolvedDocument
  const complianceItem = share.resolvedComplianceItem as { item: { label: string; phase: { label: string } }; answer: { status: string } | null } | null

  const label = training
    ? training.training.name
    : contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || '—'
      : doc
        ? doc.name
        : complianceItem
          ? complianceItem.item.label
          : ENTITY_LABELS[share.entityType] ?? share.entityType

  const sublabel = training
    ? [training.user?.firstName, training.user?.lastName].filter(Boolean).join(' ') || training.user?.email
    : contact
      ? CONTACT_TYPE_LABELS[contact.type ?? ""] ?? contact.type
      : doc?.folder?.name
        ? doc.folder.name
        : complianceItem
          ? `${complianceItem.item.phase.label}${complianceItem.answer ? ` · ${STATUS_CONFIG[complianceItem.answer.status]?.label ?? complianceItem.answer.status}` : ''}`
          : null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border/50 first:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <button onClick={onRevoke} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function ReceivedList({ shares }: { shares: Share[] }) {
  // Group all shares by cabinet
  const cabinetMap = new Map<string, { cabinetName: string; shares: Share[] }>()
  for (const share of shares) {
    const cabinetId = share.cabinetId ?? 'unknown'
    const cabinetName = share.cabinet?.name ?? 'Cabinet inconnu'
    if (!cabinetMap.has(cabinetId)) {
      cabinetMap.set(cabinetId, { cabinetName, shares: [] })
    }
    cabinetMap.get(cabinetId)!.shares.push(share)
  }

  return (
    <div className="space-y-2">
      {Array.from(cabinetMap.entries()).map(([cabinetId, { cabinetName, shares: cabinetShares }]) => (
        <CabinetReceivedGroup key={cabinetId} cabinetId={cabinetId} cabinetName={cabinetName} shares={cabinetShares} />
      ))}
    </div>
  )
}

function TrainingShareRow({ share }: { share: Share }) {
  const { token } = useAuthStore()
  const t = share.resolvedTraining
  const [viewingCert, setViewingCert] = useState(false)
  if (!t) return <div className="px-4 py-2.5 text-xs text-muted-foreground">Formation introuvable</div>

  const member = t.member as { externalFirstName?: string | null; externalLastName?: string | null; externalEmail?: string | null } | null
  const userName =
    [t.user?.firstName, t.user?.lastName].filter(Boolean).join(' ') ||
    t.user?.email ||
    [member?.externalFirstName, member?.externalLastName].filter(Boolean).join(' ') ||
    member?.externalEmail ||
    '—'

  const dateFrom = new Date(t.trainingDate).toLocaleDateString('fr-FR')
  const dateTo = t.trainingDateEnd ? ` → ${new Date(t.trainingDateEnd).toLocaleDateString('fr-FR')}` : ''

  const cert = t.certificate ?? null
  const certAsDoc: Document | null = cert
    ? { id: cert.id, name: cert.name, mimeType: cert.mimeType ?? null, description: null, storageMode: 'hosted', sizeBytes: null, folderId: null, createdAt: '', links: [], tags: [] }
    : null

  return (
    <>
      {viewingCert && certAsDoc && <DocumentViewer document={certAsDoc} onClose={() => setViewingCert(false)} shared />}
      <div className="flex items-start gap-3 px-4 py-2.5 border-t border-border/50 first:border-0">
        <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{t.training.name}</p>
          <p className="text-xs text-muted-foreground">{userName} · {dateFrom}{dateTo}{t.hoursCompleted ? ` · ${t.hoursCompleted}h` : ''}</p>
          {t.categoryHours?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(t.categoryHours as { hours: number; category: { name: string } }[]).map((ch) => (
                <span key={ch.category.name} className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  {ch.category.name} · {ch.hours}h
                </span>
              ))}
            </div>
          )}
          {certAsDoc && (
            <button onClick={() => { setViewingCert(true); if (token) shareApi.recordView(share.id, token).catch(() => {}) }} className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
              <FileText className="h-3 w-3" />
              {certAsDoc.name}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

const CONTACT_TYPE_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  client: 'Client',
  ancien_client: 'Ancien client',
}

function ContactShareRow({ share }: { share: Share }) {
  const { token } = useAuthStore()
  const contact = share.resolvedContact as { id: string; firstName?: string | null; lastName?: string | null; email?: string | null; type?: string | null } | null
  if (!contact) return <div className="px-4 py-2.5 text-xs text-muted-foreground">Contact introuvable</div>

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || '—'
  const typeLabel = contact.type ? (CONTACT_TYPE_LABELS[contact.type ?? ""] ?? contact.type) : null

  return (
    <Link
      href={`/crm/${contact.id}?shared=1`}
      onClick={() => { if (token) shareApi.recordView(share.id, token).catch(() => {}) }}
      className="flex items-center gap-3 px-4 py-2.5 border-t border-border/50 first:border-0 hover:bg-muted/40 transition-colors group"
    >
      <User className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {typeLabel && <p className="text-xs text-muted-foreground">{typeLabel}</p>}
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  )
}

function usePersistedToggle(key: string, defaultValue = false) {
  const storageKey = `partage-open:${key}`
  const [open, setOpen] = useState(() => {
    try { return sessionStorage.getItem(storageKey) === 'true' || defaultValue } catch { return defaultValue }
  })
  const toggle = () => setOpen((v) => {
    const next = !v
    try { sessionStorage.setItem(storageKey, String(next)) } catch {}
    return next
  })
  return [open, toggle] as const
}

function SubGroup({ label, count, icon, children, storageKey }: { label: string; count: number; icon?: React.ReactNode; children: React.ReactNode; storageKey: string }) {
  const [open, toggle] = usePersistedToggle(storageKey)
  return (
    <div className="border-t border-border first:border-0">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors"
      >
        {icon ?? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left">{label}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border/50">{children}</div>}
    </div>
  )
}

function CabinetReceivedGroup({ cabinetName, cabinetId, shares }: { cabinetName: string; cabinetId: string; shares: Share[] }) {
  const [open, toggle] = usePersistedToggle(`cabinet:${cabinetId}`)

  // Sub-group: compliance items
  const complianceShares = shares.filter((s) => s.entityType === 'compliance_item')

  // Sub-group: documents by folder
  const docSharesWithFolder = shares.filter((s) => s.entityType !== 'compliance_item' && !!s.resolvedDocument?.folder)
  const folderMap = new Map<string, { name: string; shares: Share[] }>()
  for (const share of docSharesWithFolder) {
    const folder = share.resolvedDocument?.folder
    if (!folder) continue
    const folderId = folder.id
    if (!folderMap.has(folderId)) folderMap.set(folderId, { name: folder.name, shares: [] })
    folderMap.get(folderId)!.shares.push(share)
  }

  // Sub-group: trainings
  const trainingShares = shares.filter((s) => s.entityType === 'collaborator_training')

  // Sub-group: contacts
  const contactShares = shares.filter((s) => s.entityType === 'contact')

  // Remaining
  const otherShares = shares.filter(
    (s) => s.entityType !== 'compliance_item' && s.entityType !== 'collaborator_training' && s.entityType !== 'contact' && !s.resolvedDocument?.folder
  )

  const total = shares.length

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1 text-left">{cabinetName}</span>
        <span className="text-xs text-muted-foreground">{total} élément{total > 1 ? 's' : ''}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border">
          {/* Compliance items — collapsible */}
          {complianceShares.length > 0 && (
            <SubGroup label="Conformité" count={complianceShares.length} storageKey={`${cabinetId}:compliance`}>
              {complianceShares.map((share) => (
                <ComplianceItemShareRow key={share.id} share={share} />
              ))}
            </SubGroup>
          )}
          {/* Trainings — collapsible */}
          {trainingShares.length > 0 && (
            <SubGroup label="Formations" count={trainingShares.length} storageKey={`${cabinetId}:trainings`}>
              {trainingShares.map((share) => (
                <TrainingShareRow key={share.id} share={share} />
              ))}
            </SubGroup>
          )}
          {/* Contacts — collapsible */}
          {contactShares.length > 0 && (
            <SubGroup label="Contacts" count={contactShares.length} icon={<User className="h-3.5 w-3.5 text-muted-foreground" />} storageKey={`${cabinetId}:contacts`}>
              {contactShares.map((share) => (
                <ContactShareRow key={share.id} share={share} />
              ))}
            </SubGroup>
          )}
          {/* Documents grouped by folder — each folder collapsible */}
          {Array.from(folderMap.entries()).map(([folderId, { name, shares: fShares }]) => (
            <SubGroup key={folderId} label={name} count={fShares.length} icon={<Folder className="h-3.5 w-3.5 text-amber-500" />} storageKey={`${cabinetId}:folder:${folderId}`}>
              {fShares.map((share) => (
                <ShareRow key={share.id} share={share} inFolder />
              ))}
            </SubGroup>
          ))}
          {/* Other shares — flat */}
          {otherShares.map((share) => (
            <div key={share.id} className="border-t border-border first:border-0">
              <ShareRow share={share} inFolder />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ComplianceItemShareRow({ share }: { share: Share }) {
  const resolved = share.resolvedComplianceItem as { item: { label: string; type: string; phase: { label: string } }; answer: { value: unknown; status: string; submittedAt?: string; expiresAt?: string } | null } | null
  const [viewing, setViewing] = useState(false)

  if (!resolved) {
    return (
      <div className="px-4 py-2.5 text-xs text-muted-foreground">Item introuvable</div>
    )
  }

  const { item, answer } = resolved
  const status = answer?.status ?? 'not_started'
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
  const Icon = cfg.icon

  const answerText = item.type === 'text'
    ? (answer?.value as { text?: string })?.text
    : item.type !== 'doc'
      ? (Array.isArray((answer?.value as { selected?: unknown })?.selected) ? ((answer?.value as { selected: string[] }).selected).join(', ') : null)
      : null

  return (
    <>
      {viewing && <div className="px-4 py-2 text-xs text-muted-foreground">Aperçu non disponible depuis cette vue</div>}
      <div className="flex items-start gap-3 px-4 py-2.5">
        <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', cfg.className)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.label}</p>
          <p className="text-xs text-muted-foreground">{item.phase.label}</p>
          {answerText && <p className="mt-0.5 text-xs text-foreground/70 line-clamp-2">{answerText}</p>}
        </div>
        <div className="text-right shrink-0">
          <span className={cn('text-xs font-medium', cfg.className)}>{cfg.label}</span>
          {answer?.expiresAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Expire le {new Date(answer.expiresAt).toLocaleDateString('fr-FR')}</p>
          )}
        </div>
      </div>
    </>
  )
}

function CreateShareForm({ onClose }: { onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [grantedTo, setGrantedTo] = useState('')
  const [entityType, setEntityType] = useState('cabinet')

  const mutation = useMutation({
    mutationFn: () => shareApi.create({ grantedTo, entityType }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares-granted'] })
      onClose()
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Nouveau partage</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Ce que vous partagez</Label>
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">ID de l'utilisateur destinataire</Label>
        <Input value={grantedTo} onChange={(e) => setGrantedTo(e.target.value)} placeholder="UUID de l'utilisateur…" className="text-sm font-mono" />
        <p className="text-xs text-muted-foreground">L'utilisateur doit déjà avoir un compte sur la plateforme.</p>
      </div>
      {mutation.isError && <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !grantedTo.trim()}>
          {mutation.isPending ? 'Création…' : 'Créer le partage'}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  )
}

function ActivityList({ shares, onRevoke }: { shares: ShareWithViewLog[]; onRevoke: (id: string) => void }) {
  const recipientMap = new Map<string, { email: string; shares: ShareWithViewLog[] }>()
  for (const share of shares) {
    const id = share.recipientUser.id
    if (!recipientMap.has(id)) recipientMap.set(id, { email: share.recipientUser.email, shares: [] })
    recipientMap.get(id)!.shares.push(share)
  }
  return (
    <div className="space-y-2">
      {Array.from(recipientMap.entries()).map(([recipientId, { email, shares: rShares }]) => (
        <ActivityRecipientGroup key={recipientId} recipientId={recipientId} email={email} shares={rShares} onRevoke={onRevoke} />
      ))}
    </div>
  )
}

function ActivityRecipientGroup({ recipientId, email, shares, onRevoke }: { recipientId: string; email: string; shares: ShareWithViewLog[]; onRevoke: (id: string) => void }) {
  const [open, toggle] = usePersistedToggle(`activity:${recipientId}`)
  const viewedCount = shares.filter((s) => s.viewLogs.length > 0).length

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/50 transition-colors">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1 text-left">{email}</span>
        <span className="text-xs text-muted-foreground mr-2">{shares.length} élément{shares.length > 1 ? 's' : ''}</span>
        {viewedCount > 0
          ? <span className="text-xs text-success font-medium">{viewedCount} consulté{viewedCount > 1 ? 's' : ''}</span>
          : <span className="text-xs text-muted-foreground">Jamais consulté</span>
        }
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" /> : <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />}
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border/50">
          {shares
            .sort((a, b) => (b.viewLogs[0]?.viewedAt ?? '').localeCompare(a.viewLogs[0]?.viewedAt ?? ''))
            .map((share) => (
              <ActivityShareRow key={share.id} share={share} onRevoke={() => onRevoke(share.id)} />
            ))}
        </div>
      )}
    </div>
  )
}

function ActivityShareRow({ share, onRevoke }: { share: ShareWithViewLog; onRevoke: () => void }) {
  const lastView = share.viewLogs[0]
  const viewed = !!lastView

  const training = share.resolvedTraining
  const contact = share.resolvedContact
  const doc = share.resolvedDocument
  const complianceItem = share.resolvedComplianceItem as { item: { label: string; phase: { label: string } } } | null

  const label = training
    ? training.training.name
    : contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || '—'
      : doc
        ? doc.name
        : complianceItem
          ? complianceItem.item.label
          : ENTITY_LABELS[share.entityType] ?? share.entityType

  const sublabel = training
    ? (() => { const m = training.member; return [training.user?.firstName, training.user?.lastName].filter(Boolean).join(' ') || training.user?.email || [m?.externalFirstName, m?.externalLastName].filter(Boolean).join(' ') || m?.externalEmail })()
    : contact
      ? CONTACT_TYPE_LABELS[contact.type ?? ""] ?? contact.type
      : doc?.folder?.name ?? (complianceItem ? complianceItem.item.phase.label : null)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 group">
      <div className={cn('h-2 w-2 rounded-full shrink-0', viewed ? 'bg-success' : 'bg-muted-foreground/30')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <div className="text-right shrink-0">
        {viewed
          ? <p className="text-xs text-success">
              {new Date(lastView.viewedAt).toLocaleDateString('fr-FR')} à {new Date(lastView.viewedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          : <p className="text-xs text-muted-foreground">Jamais consulté</p>
        }
      </div>
      <button onClick={onRevoke} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'granted' | 'received' | 'compliance' | 'activity'

export default function PartagePage() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const isChamber = user?.globalRole === 'chamber' || user?.globalRole === 'regulator'
  const [tab, setTab] = useState<Tab>(isChamber ? 'received' : 'granted')
  const [adding, setAdding] = useState(false)
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const complianceLoggedRef = useRef(false)

  const { data: grantedData, isLoading: loadingGranted } = useQuery({
    queryKey: ['shares-granted', token],
    queryFn: () => shareApi.listGranted(token!),
    enabled: !!token,
  })

  const { data: receivedData, isLoading: loadingReceived } = useQuery({
    queryKey: ['shares-received', token],
    queryFn: () => shareApi.listReceived(token!),
    enabled: !!token,
  })

  const { data: activityData, isLoading: loadingActivity } = useQuery({
    queryKey: ['shares-activity', token],
    queryFn: () => shareApi.viewsSummary(token!),
    enabled: !!token && tab === 'activity',
  })

  const { data: complianceData, isLoading: loadingCompliance } = useQuery({
    queryKey: ['compliance-shared-with-me', token],
    queryFn: () => complianceShareApi.sharedWithMe(token!),
    enabled: !!token && tab === 'compliance',
  })

  const cabinets = complianceData?.data.cabinets ?? []

  // Log la consultation de chaque share de conformité (une seule fois par chargement)
  useEffect(() => {
    if (!token || !complianceData || complianceLoggedRef.current) return
    complianceLoggedRef.current = true
    const shareIds = [...new Set(cabinets.flatMap((c) => c.items.map((i) => i.shareId)))]
    shareIds.forEach((id) => shareApi.recordView(id, token).catch(() => {}))
  }, [complianceData]) // eslint-disable-line react-hooks/exhaustive-deps

  const revokeMutation = useMutation({
    mutationFn: (id: string) => shareApi.revoke(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares-granted'] })
      queryClient.invalidateQueries({ queryKey: ['shares-activity'] })
    },
  })

  const granted = grantedData?.data.shares ?? []
  const received = receivedData?.data.shares ?? []
  const activity = activityData?.data.shares ?? []

  const viewedCount = activity.filter((s) => s.viewLogs.length > 0).length
  const neverViewedCount = activity.filter((s) => s.viewLogs.length === 0).length

  const isLoading =
    tab === 'granted' ? loadingGranted :
    tab === 'received' ? loadingReceived :
    tab === 'compliance' ? loadingCompliance :
    loadingActivity

  const ALL_TABS: { key: Tab; label: string; icon: React.ElementType; count: number | null; chamberOnly?: boolean; hiddenForChamber?: boolean }[] = [
    { key: 'granted',    label: 'Accordés',           icon: ArrowUpRight,  count: granted.length,           hiddenForChamber: true },
    { key: 'received',   label: 'Reçus',              icon: ArrowDownLeft, count: received.length },
    { key: 'compliance', label: 'Conformité reçue',   icon: ShieldCheck,   count: cabinets.length || null },
    { key: 'activity',   label: 'Activité',           icon: Activity,      count: null,                     hiddenForChamber: true },
  ]
  const TABS = ALL_TABS.filter((t) => !(isChamber && t.hiddenForChamber))

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Partage</h2>
          <p className="text-muted-foreground mt-1">Partagez vos données et consultez ce que les autres cabinets partagent avec vous.</p>
        </div>
        {tab === 'granted' && !adding && !isChamber && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau partage
          </Button>
        )}
      </div>

      {adding && <CreateShareForm onClose={() => setAdding(false)} />}

      {/* Onglets */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px shrink-0',
              tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count !== null && <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{count}</span>}
          </button>
        ))}
      </div>

      {/* Stats activité */}
      {tab === 'activity' && !loadingActivity && activity.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{activity.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Partages actifs</p>
          </div>
          <div className="bg-success/5 border border-success/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums text-success">{viewedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Consultés</p>
          </div>
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums text-muted-foreground">{neverViewedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Jamais consultés</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : tab === 'compliance' ? (
        cabinets.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Aucune conformité partagée</p>
            <p className="text-sm text-muted-foreground mt-1">Les cabinets qui partagent leur conformité avec vous apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cabinets.map((entry) => <CabinetComplianceCard key={entry.cabinet.id} entry={entry} />)}
          </div>
        )
      ) : tab === 'activity' ? (
        activity.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Aucun partage actif</p>
            <p className="text-sm text-muted-foreground mt-1">Les consultations de vos partages apparaîtront ici.</p>
          </div>
        ) : (
          <ActivityList shares={activity} onRevoke={(id) => setConfirmState({ message: 'Révoquer ce partage ?', onConfirm: () => revokeMutation.mutate(id) })} />
        )
      ) : (tab === 'granted' ? granted : received).length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="font-medium">
            {tab === 'granted' ? 'Aucun partage accordé' : 'Aucun partage reçu'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === 'granted'
              ? 'Partagez vos données avec un autre cabinet via le bouton ci-dessus.'
              : "Vous n'avez pas encore reçu de partage d'un autre cabinet."}
          </p>
        </div>
      ) : tab === 'granted' ? (
        <GrantedList shares={granted} onRevoke={(id) => setConfirmState({ message: 'Révoquer ce partage ?', onConfirm: () => revokeMutation.mutate(id) })} />
      ) : (
        <ReceivedList shares={received} />
      )}

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          confirmLabel="Révoquer"
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  )
}
