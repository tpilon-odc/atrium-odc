'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronRight, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Circle, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { complianceApi, type PhaseProgress } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ShareModal, type ShareableEntity } from '@/components/ui/ShareModal'

type ShareTarget = { entities: ShareableEntity[] }

// ── Helpers badge statut ────────────────────────────────────────────────────

function itemBadge(status: string): ShareableEntity['badge'] {
  if (status === 'submitted') return { label: 'Conforme', variant: 'ok' }
  if (status === 'expiring_soon') return { label: 'Expire bientôt', variant: 'warn' }
  if (status === 'expired') return { label: 'Expiré', variant: 'error' }
  return { label: 'Non renseigné', variant: 'neutral' }
}

// ── Helpers statuts ────────────────────────────────────────────────────────

function statusIcon(status: string) {
  switch (status) {
    case 'submitted':     return <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
    case 'expiring_soon': return <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
    case 'expired':       return <XCircle       className="h-3.5 w-3.5 text-danger shrink-0" />
    default:              return <Circle        className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
  }
}

// ── Résumé statuts d'une phase ─────────────────────────────────────────────

function PhaseStatusSummary({ items }: { items: PhaseProgress['items'] }) {
  const submitted = items.filter((i) => i.status === 'submitted' || i.status === 'expiring_soon').length
  const expired   = items.filter((i) => i.status === 'expired').length
  const pending   = items.filter((i) => i.status === 'not_started' || i.status === 'draft').length

  return (
    <div className="flex items-center gap-3 mt-2 text-xs">
      {submitted > 0 && (
        <span className="flex items-center gap-1 text-success">
          <CheckCircle2 className="h-3 w-3" />
          {submitted} conforme{submitted > 1 ? 's' : ''}
        </span>
      )}
      {expired > 0 && (
        <span className="flex items-center gap-1 text-danger">
          <XCircle className="h-3 w-3" />
          {expired} expiré{expired > 1 ? 's' : ''}
        </span>
      )}
      {pending > 0 && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Circle className="h-3 w-3" />
          {pending} en attente
        </span>
      )}
    </div>
  )
}

// ── Phase card ─────────────────────────────────────────────────────────────

function PhaseCard({ phase, onShare }: { phase: PhaseProgress; onShare: (entities: ShareableEntity[]) => void }) {
  const { progress } = phase
  const pct      = progress?.percentage ?? 0
  const hasIssue = phase.items.some((i) => i.status === 'expired')
  const hasSoon  = phase.items.some((i) => i.status === 'expiring_soon')

  const barColor =
    pct === 100 ? 'bg-success'
    : hasIssue   ? 'bg-danger'
    : hasSoon    ? 'bg-warning'
    : pct > 0    ? 'bg-primary'
    : 'bg-muted-foreground/20'

  const pctBadgeClass =
    pct === 100 ? 'bg-success-subtle text-success-subtle-foreground'
    : hasIssue   ? 'bg-danger-subtle text-danger-subtle-foreground'
    : hasSoon    ? 'bg-warning-subtle text-warning-subtle-foreground'
    : 'bg-muted text-muted-foreground'

  const phaseEntities: ShareableEntity[] = phase.items.map((i) => ({
    id: i.id,
    label: i.label,
    sublabel: phase.name,
    badge: itemBadge(i.status),
  }))

  return (
    <div className="relative group/card">
      <Link
        href={`/conformite/${phase.id}`}
        className="block bg-card border border-border rounded-lg p-5 hover:bg-accent/30 transition-colors group"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium">{phase.name}</p>
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums', pctBadgeClass)}>
                {pct}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {progress?.completed ?? 0} / {progress?.total ?? 0} items complétés
            </p>

            {/* Progress bar */}
            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>

            <PhaseStatusSummary items={phase.items} />
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); onShare(phaseEntities) }}
        title="Partager cette phase"
        className="absolute top-3 right-10 opacity-0 group-hover/card:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ConformitePage() {
  const { token } = useAuthStore()
  const [shareOpen, setShareOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)

  function openShare(entities: ShareableEntity[]) {
    setShareTarget({ entities })
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['compliance-progress', token],
    queryFn: () => complianceApi.getProgress(token!),
    enabled: !!token,
  })

  const phases = data?.data.phases ?? []
  const globalProgress = data?.data.globalProgress ?? 0

  const hasIssues = phases.some((p) => p.items.some((i) => i.status === 'expired'))
  const globalBarColor =
    globalProgress === 100 ? 'bg-success'
    : hasIssues             ? 'bg-danger'
    : globalProgress > 0    ? 'bg-primary'
    : 'bg-muted-foreground/20'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* En-tête avec progression globale */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Conformité</h2>
            <p className="text-muted-foreground mt-1">Suivez votre progression réglementaire par phase.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!isLoading && phases.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
                <Share2 className="h-3.5 w-3.5 mr-1.5" />
                Partager
              </Button>
            )}
            {!isLoading && (
              <div className="text-right">
                <p className="text-3xl font-semibold tabular-nums">{globalProgress}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Progression globale</p>
              </div>
            )}
          </div>
        </div>

        {/* Barre globale */}
        {!isLoading && phases.length > 0 && (
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', globalBarColor)}
              style={{ width: `${globalProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* États de chargement */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-danger-subtle text-danger-subtle-foreground text-sm px-4 py-3 rounded-lg">
          Erreur : {(error as Error).message}
        </div>
      )}

      {!isLoading && phases.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Aucune phase configurée</p>
          <p className="text-sm text-muted-foreground mt-1">
            Un administrateur doit configurer les phases et items de conformité.
          </p>
        </div>
      )}

      {/* Liste des phases */}
      <div className="space-y-3">
        {phases
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((phase) => (
            <PhaseCard key={phase.id} phase={phase} onShare={openShare} />
          ))}
      </div>

      {(shareOpen || shareTarget) && (
        <ShareModal
          title="Partager des items de conformité"
          description="Sélectionnez les items et les destinataires (chambres / régulateurs)"
          entityType="compliance_item"
          entities={shareTarget?.entities ?? phases.flatMap((p) =>
            p.items.map((i) => ({
              id: i.id,
              label: i.label,
              sublabel: p.name,
              badge: itemBadge(i.status),
            }))
          )}
          onClose={() => { setShareOpen(false); setShareTarget(null) }}
        />
      )}
    </div>
  )
}
