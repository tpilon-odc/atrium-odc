'use client'

import { useQueries } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ShieldCheck,
  Building2,
  Users,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { complianceApi, supplierApi, contactApi, documentApi, displayName, type PhaseProgress } from '@/lib/api'

// ── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
  loading,
  color = 'primary',
}: {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  loading?: boolean
  color?: 'primary' | 'success' | 'warning' | 'info'
}) {
  const colors = {
    primary: 'text-primary bg-primary/10',
    success:  'text-success bg-success-subtle',
    warning:  'text-warning bg-warning-subtle',
    info:     'text-info bg-info-subtle',
  }
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex items-start gap-4">
      <div className={cn('p-2.5 rounded-lg shrink-0', colors[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <div className="h-8 w-16 bg-muted animate-pulse rounded mt-1" />
        ) : (
          <p className="text-2xl font-semibold mt-0.5 tabular-nums">{value}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Phase progress bar ─────────────────────────────────────────────────────

function PhaseBar({ phase }: { phase: PhaseProgress }) {
  const { progress } = phase
  const pct = progress?.percentage ?? 0
  const barColor =
    progress?.status === 'completed' ? 'bg-success'
    : pct > 0 ? 'bg-primary'
    : 'bg-muted-foreground/20'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate pr-4">{phase.name}</span>
        <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
          {progress?.completed ?? 0}/{progress?.total ?? 0}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { token, user, cabinet } = useAuthStore()

  const [complianceQ, suppliersQ, contactsQ, documentsQ] = useQueries({
    queries: [
      {
        queryKey: ['compliance-progress', token],
        queryFn: () => complianceApi.getProgress(token!),
        enabled: !!token,
      },
      {
        queryKey: ['suppliers-count', token],
        queryFn: () => supplierApi.list(token!, { limit: 1 }),
        enabled: !!token,
      },
      {
        queryKey: ['contacts-count', token],
        queryFn: () => contactApi.list(token!, { limit: 1 }),
        enabled: !!token,
      },
      {
        queryKey: ['documents-count', token],
        queryFn: () => documentApi.list(token!, { limit: 1 }),
        enabled: !!token,
      },
    ],
  })

  const complianceData = complianceQ.data?.data
  const overallPct = complianceData?.globalProgress ?? 0
  const phases = (complianceData?.phases ?? []).filter((p) => !!p?.id)

  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  // Items nécessitant une action (expirés ou expirant bientôt)
  const urgentItems = phases.flatMap((p) =>
    p.items
      .filter((i) => i.status === 'expired' || i.status === 'expiring_soon')
      .map((i) => ({ ...i, phaseName: p.name, phaseId: p.id }))
  )

  // Items non démarrés (requis)
  const notStartedItems = phases.flatMap((p) =>
    p.items
      .filter((i) => i.status === 'not_started')
      .map((i) => ({ ...i, phaseName: p.name, phaseId: p.id }))
  ).slice(0, 3)

  const suppliersCount = suppliersQ.data?.data.suppliers.length ?? 0
  const suppliersHasMore = suppliersQ.data?.data.hasMore
  const contactsCount = contactsQ.data?.data.contacts.length ?? 0
  const contactsHasMore = contactsQ.data?.data.hasMore
  const documentsCount = documentsQ.data?.data.documents.length ?? 0
  const documentsHasMore = documentsQ.data?.data.hasMore

  const formatCount = (n: number, hasMore: boolean | undefined) =>
    hasMore ? `${n}+` : String(n)

  const actionCount = urgentItems.length + notStartedItems.length

  return (
    <div className="space-y-6 max-w-5xl">
      {/* En-tête */}
      <div>
        <h2 className="text-2xl font-semibold">Tableau de bord</h2>
        <p className="text-muted-foreground mt-1">
          {cabinet?.name ?? '—'} · Bonjour, {user ? displayName(user) : '—'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Conformité"
          value={`${overallPct}%`}
          icon={ShieldCheck}
          sub={`${phases.filter((p) => p.progress?.status === 'completed').length}/${phases.length} phases`}
          loading={complianceQ.isLoading}
          color="primary"
        />
        <KpiCard
          label="Fournisseurs"
          value={formatCount(suppliersCount, suppliersHasMore)}
          icon={Building2}
          loading={suppliersQ.isLoading}
          color="info"
        />
        <KpiCard
          label="Contacts"
          value={formatCount(contactsCount, contactsHasMore)}
          icon={Users}
          loading={contactsQ.isLoading}
          color="success"
        />
        <KpiCard
          label="Documents"
          value={formatCount(documentsCount, documentsHasMore)}
          icon={FolderOpen}
          loading={documentsQ.isLoading}
          color="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* À faire */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-medium">À faire</h3>
            {actionCount > 0 && (
              <span className="ml-auto text-xs bg-warning-subtle text-warning-subtle-foreground px-2 py-0.5 rounded-full font-medium">
                {actionCount}
              </span>
            )}
          </div>

          {complianceQ.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : actionCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <p className="text-sm text-muted-foreground text-center">
                {phases.length === 0
                  ? 'Aucune phase de conformité configurée.'
                  : 'Aucune action requise. Tout est à jour.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {urgentItems.map((item, idx) => {
                const isExpired = item.status === 'expired'
                const expiresAt = item.answer?.expiresAt ? new Date(item.answer.expiresAt) : null
                const daysLeft = expiresAt
                  ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <li key={idx}>
                    <Link
                      href={`/conformite/${item.phaseId}`}
                      className="flex items-start justify-between gap-3 text-sm py-2.5 px-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.phaseName}</p>
                      </div>
                      <span className={cn(
                        'shrink-0 text-xs font-medium px-2 py-0.5 rounded-full',
                        isExpired
                          ? 'bg-danger-subtle text-danger-subtle-foreground'
                          : 'bg-warning-subtle text-warning-subtle-foreground'
                      )}>
                        {isExpired ? 'Expiré' : daysLeft !== null ? `J-${daysLeft}` : 'Bientôt'}
                      </span>
                    </Link>
                  </li>
                )
              })}
              {notStartedItems.map((item, idx) => (
                <li key={`ns-${idx}`}>
                  <Link
                    href={`/conformite/${item.phaseId}`}
                    className="flex items-start justify-between gap-3 text-sm py-2.5 px-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.phaseName}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      À démarrer
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Progression par phase */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Progression par phase</h3>
            {overallPct > 0 && (
              <span className={cn(
                'ml-auto text-xs font-semibold px-2 py-0.5 rounded-full',
                overallPct === 100
                  ? 'bg-success-subtle text-success-subtle-foreground'
                  : overallPct >= 50
                    ? 'bg-primary/10 text-primary'
                    : 'bg-warning-subtle text-warning-subtle-foreground'
              )}>
                {overallPct}%
              </span>
            )}
          </div>

          {complianceQ.isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-1.5 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : phases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune phase configurée.</p>
          ) : (
            <div className="space-y-4">
              {phases
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((p) => (
                  <PhaseBar key={p.id} phase={p} />
                ))}
            </div>
          )}

          {phases.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <Link
                href="/conformite"
                className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
              >
                <Clock className="h-3.5 w-3.5" />
                Voir la conformité complète
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
