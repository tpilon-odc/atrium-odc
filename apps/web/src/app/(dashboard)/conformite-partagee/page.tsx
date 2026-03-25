'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, AlertTriangle, XCircle, Circle, Building2, Eye, FileText } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { complianceShareApi, shareApi, type ComplianceShareCabinet, type Document } from '@/lib/api'
import { DocumentViewer } from '@/components/ui/DocumentViewer'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  submitted:     { label: 'Conforme',       icon: CheckCircle2,   className: 'text-green-600' },
  expiring_soon: { label: 'Expire bientôt', icon: AlertTriangle,  className: 'text-amber-500' },
  expired:       { label: 'Expiré',         icon: XCircle,        className: 'text-red-500' },
  not_started:   { label: 'Non renseigné',  icon: Circle,         className: 'text-muted-foreground/40' },
  draft:         { label: 'Brouillon',      icon: Circle,         className: 'text-muted-foreground/40' },
}

function ItemRow({ item: shared }: { item: ComplianceShareCabinet['items'][0] }) {
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
      ? ((shared.answer?.value as { selected?: string[] })?.selected ?? []).join(', ')
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
            <button
              onClick={() => setViewing(true)}
              className="mt-1.5 flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              {docAsDocument.name}
              <Eye className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {answerText && (
            <p className="mt-1 text-xs text-foreground/70 line-clamp-2">{answerText}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className={cn('text-xs font-medium', cfg.className)}>{cfg.label}</span>
          {shared.answer?.expiresAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Expire le {new Date(shared.answer.expiresAt).toLocaleDateString('fr-FR')}
            </p>
          )}
          {shared.answer?.submittedAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Soumis le {new Date(shared.answer.submittedAt).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
      </div>
    </>
  )
}

function CabinetCard({ entry }: { entry: ComplianceShareCabinet }) {
  const { cabinet, items } = entry
  const submitted = items.filter((i) => i.status === 'submitted' || i.status === 'expiring_soon').length
  const total = items.length
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium text-sm">{cabinet.name}</p>
            {cabinet.oriasNumber && (
              <p className="text-xs text-muted-foreground">ORIAS : {cabinet.oriasNumber}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-semibold tabular-nums">{pct}%</p>
          <p className="text-[10px] text-muted-foreground">{submitted}/{total} conforme{submitted > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="h-1 bg-muted">
        <div
          className={cn('h-full transition-all', pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-primary' : 'bg-amber-500')}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="px-5 py-1">
        {items.map((item) => (
          <ItemRow key={item.shareId} item={item} />
        ))}
      </div>
    </div>
  )
}

export default function ConformitePartageeePage() {
  const { token } = useAuthStore()
  const loggedRef = useRef(false)

  const { data, isLoading } = useQuery({
    queryKey: ['compliance-shared-with-me', token],
    queryFn: () => complianceShareApi.sharedWithMe(token!),
    enabled: !!token,
  })

  const cabinets = data?.data.cabinets ?? []

  // Log la consultation de chaque share unique (une seule fois par chargement)
  useEffect(() => {
    if (!token || !data || loggedRef.current) return
    loggedRef.current = true
    const shareIds = [...new Set(cabinets.flatMap((c) => c.items.map((i) => i.shareId)))]
    shareIds.forEach((id) => shareApi.recordView(id, token).catch(() => {}))
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold">Conformité partagée</h2>
        <p className="text-muted-foreground mt-1">
          Items de conformité partagés avec vous par les cabinets.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
        </div>
      )}

      {!isLoading && cabinets.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Aucun partage reçu</p>
          <p className="text-sm text-muted-foreground mt-1">
            Les cabinets qui partagent leur conformité avec vous apparaîtront ici.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {cabinets.map((entry) => (
          <CabinetCard key={entry.cabinet.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}
