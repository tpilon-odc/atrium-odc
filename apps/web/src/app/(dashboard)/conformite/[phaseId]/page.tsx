'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Lock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  PenLine,
  Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { complianceApi, type PhaseProgress } from '@/lib/api'
import { StatusBadge } from '@/components/compliance/StatusBadge'
import { AnswerForm } from '@/components/compliance/AnswerForm'
import { ShareModal, type ShareableEntity } from '@/components/ui/ShareModal'

type Item = PhaseProgress['items'][number]

function itemBadge(status: string): ShareableEntity['badge'] {
  if (status === 'submitted') return { label: 'Conforme', variant: 'ok' }
  if (status === 'expiring_soon') return { label: 'Expire bientôt', variant: 'warn' }
  if (status === 'expired') return { label: 'Expiré', variant: 'error' }
  return { label: 'Non renseigné', variant: 'neutral' }
}

// ── Icône statut ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'submitted':
      return <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
    case 'expiring_soon':
      return <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
    case 'expired':
      return <XCircle className="h-4 w-4 text-danger shrink-0" />
    case 'draft':
      return <PenLine className="h-4 w-4 text-info shrink-0" />
    case 'blocked':
      return <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
  }
}

// ── Expiry display ──────────────────────────────────────────────────────────

function ExpiryLabel({ expiresAt }: { expiresAt: string }) {
  const date    = new Date(expiresAt)
  const now     = new Date()
  const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const isUrgent = daysLeft <= 30
  const isExpired = daysLeft <= 0

  return (
    <span className={cn(
      'text-xs',
      isExpired ? 'text-danger font-medium'
      : isUrgent ? 'text-warning font-medium'
      : 'text-muted-foreground'
    )}>
      {isExpired
        ? `Expiré le ${date.toLocaleDateString('fr-FR')}`
        : `Expire le ${date.toLocaleDateString('fr-FR')}${isUrgent ? ` (J-${daysLeft})` : ''}`}
    </span>
  )
}

// ── Item card ───────────────────────────────────────────────────────────────

function ItemCard({ item, phaseId, phaseName, onShare }: { item: Item; phaseId: string; phaseName: string; onShare: (entity: ShareableEntity) => void }) {
  const [open, setOpen] = useState(false)
  const isBlocked = item.status === 'blocked'

  const borderColor =
    item.status === 'expired'       ? 'border-danger/30'
    : item.status === 'expiring_soon' ? 'border-warning/30'
    : item.status === 'submitted'   ? 'border-success/20'
    : 'border-border'

  return (
    <div className={cn('bg-card border rounded-lg overflow-hidden transition-colors group/item', borderColor, isBlocked && 'opacity-60')}>
      <div className="flex items-center">
        <button
          className="flex-1 flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/40 transition-colors disabled:cursor-not-allowed"
          onClick={() => !isBlocked && setOpen((o) => !o)}
          disabled={isBlocked}
        >
          <StatusIcon status={item.status} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{item.label}</span>
              {!(item as unknown as { isRequired: boolean }).isRequired && (
                <span className="text-xs text-muted-foreground">(optionnel)</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <StatusBadge status={isBlocked ? 'blocked' : item.status} />
              {item.answer?.expiresAt && (
                <ExpiryLabel expiresAt={item.answer.expiresAt} />
              )}
            </div>
          </div>

          {!isBlocked && (
            open
              ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        <button
          onClick={() => onShare({ id: item.id, label: item.label, sublabel: phaseName, badge: itemBadge(item.status) })}
          title="Partager cet item"
          className="opacity-0 group-hover/item:opacity-100 transition-opacity px-3 py-4 text-muted-foreground hover:text-primary shrink-0"
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && !isBlocked && (
        <div className="px-5 pb-5 pt-1 border-t border-border bg-background/50">
          <AnswerForm item={item} phaseId={phaseId} />
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PhaseDetailPage({ params }: { params: { phaseId: string } }) {
  const { token } = useAuthStore()
  const [shareEntity, setShareEntity] = useState<ShareableEntity | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['compliance-progress', token],
    queryFn: () => complianceApi.getProgress(token!),
    enabled: !!token,
  })

  const phase = data?.data.phases.find((p) => p.id === params.phaseId)

  const required = phase?.items.filter((i) => (i as unknown as { isRequired: boolean }).isRequired) ?? []
  const optional = phase?.items.filter((i) => !(i as unknown as { isRequired: boolean }).isRequired) ?? []

  const pct = phase?.progress?.percentage ?? 0
  const barColor =
    pct === 100 ? 'bg-success'
    : phase?.items.some((i) => i.status === 'expired') ? 'bg-danger'
    : phase?.items.some((i) => i.status === 'expiring_soon') ? 'bg-warning'
    : pct > 0 ? 'bg-primary'
    : 'bg-muted-foreground/20'

  return (
    <div className="space-y-6 max-w-7xl">
      <Link
        href="/conformite"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux phases
      </Link>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !phase && (
        <p className="text-muted-foreground">Phase introuvable.</p>
      )}

      {phase && (
        <>
          {/* En-tête phase */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{phase.name}</h2>
                <p className="text-muted-foreground mt-1">
                  {phase.progress?.completed ?? 0} / {phase.progress?.total ?? 0} items complétés
                  {' · '}
                  <span className="font-medium">{pct}%</span>
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Items requis */}
          {required.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
                Requis ({required.length})
              </h3>
              {required.map((item) => (
                <ItemCard key={item.id} item={item} phaseId={params.phaseId} phaseName={phase.name} onShare={setShareEntity} />
              ))}
            </section>
          )}

          {/* Items optionnels */}
          {optional.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
                Optionnels ({optional.length})
              </h3>
              {optional.map((item) => (
                <ItemCard key={item.id} item={item} phaseId={params.phaseId} phaseName={phase.name} onShare={setShareEntity} />
              ))}
            </section>
          )}
        </>
      )}

      {shareEntity && (
        <ShareModal
          title="Partager un item de conformité"
          description="Sélectionnez les destinataires (chambres / régulateurs)"
          entityType="compliance_item"
          entities={[shareEntity]}
          onClose={() => setShareEntity(null)}
        />
      )}
    </div>
  )
}
