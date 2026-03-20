'use client'

import { useQueries } from '@tanstack/react-query'
import { ShieldCheck, Building2, Users, FolderOpen, AlertTriangle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { complianceApi, supplierApi, contactApi, documentApi, type PhaseProgress } from '@/lib/api'

// ── Composants ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
  loading,
  color = 'blue',
}: {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  loading?: boolean
  color?: 'blue' | 'green' | 'orange' | 'purple'
}) {
  const colors = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    orange: 'text-orange-600 bg-orange-50',
    purple: 'text-purple-600 bg-purple-50',
  }
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex items-start gap-4">
      <div className={cn('p-2.5 rounded-lg shrink-0', colors[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <div className="h-8 w-16 bg-muted animate-pulse rounded mt-1" />
        ) : (
          <p className="text-2xl font-semibold mt-0.5">{value}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function PhaseBar({ phase }: { phase: PhaseProgress }) {
  const { progress } = phase
  const statusColor =
    progress?.status === 'completed'
      ? 'bg-green-500'
      : progress?.status === 'in_progress'
        ? 'bg-blue-500'
        : 'bg-muted'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate pr-4">{phase.name}</span>
        <span className="text-muted-foreground shrink-0">
          {progress?.completed ?? 0}/{progress?.total ?? 0}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', statusColor)}
          style={{ width: `${progress?.percentage ?? 0}%` }}
        />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

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

  // Items expirant dans les 30 prochains jours
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiringSoon = phases.flatMap((p) =>
    p.items
      .filter((i) => {
        if (!i.answer?.expiresAt) return false
        const d = new Date(i.answer.expiresAt)
        return d > now && d <= in30
      })
      .map((i) => ({ ...i, phaseName: p.name }))
  )

  // Comptage approximatif — l'API ne retourne pas de total, on affiche ce qu'on a
  const suppliersCount = suppliersQ.data?.data.suppliers.length ?? 0
  const suppliersHasMore = suppliersQ.data?.data.hasMore
  const contactsCount = contactsQ.data?.data.contacts.length ?? 0
  const contactsHasMore = contactsQ.data?.data.hasMore
  const documentsCount = documentsQ.data?.data.documents.length ?? 0
  const documentsHasMore = documentsQ.data?.data.hasMore

  const formatCount = (n: number, hasMore: boolean | undefined) =>
    hasMore ? `${n}+` : String(n)

  return (
    <div className="space-y-8 max-w-5xl">
      {/* En-tête */}
      <div>
        <h2 className="text-2xl font-semibold">Tableau de bord</h2>
        <p className="text-muted-foreground mt-1">
          {cabinet?.name ?? '—'} · Bonjour, {user?.email}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Conformité globale"
          value={`${overallPct}%`}
          icon={ShieldCheck}
          sub={`${phases.filter((p) => p.progress?.status === 'completed').length}/${phases.length} phases`}
          loading={complianceQ.isLoading}
          color="blue"
        />
        <KpiCard
          label="Fournisseurs"
          value={formatCount(suppliersCount, suppliersHasMore)}
          icon={Building2}
          loading={suppliersQ.isLoading}
          color="purple"
        />
        <KpiCard
          label="Contacts"
          value={formatCount(contactsCount, contactsHasMore)}
          icon={Users}
          loading={contactsQ.isLoading}
          color="green"
        />
        <KpiCard
          label="Documents"
          value={formatCount(documentsCount, documentsHasMore)}
          icon={FolderOpen}
          loading={documentsQ.isLoading}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conformité par phase */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Progression par phase</h3>
          </div>

          {complianceQ.isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-2 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : phases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune phase de conformité configurée.</p>
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
        </div>

        {/* Alertes d'expiration */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h3 className="font-medium">Expirations dans 30 jours</h3>
            {expiringSoon.length > 0 && (
              <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {expiringSoon.length}
              </span>
            )}
          </div>

          {complianceQ.isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : expiringSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {phases.length === 0
                ? 'Aucune donnée de conformité.'
                : 'Aucune expiration imminente. Tout est à jour.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {expiringSoon.map((item, idx) => {
                const expiresAt = new Date(item.answer!.expiresAt!)
                const daysLeft = Math.ceil(
                  (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <li
                    key={idx}
                    className="flex items-start justify-between gap-3 text-sm py-2 border-b border-border last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.phaseName}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-xs font-medium px-2 py-0.5 rounded-full',
                        daysLeft <= 7
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      )}
                    >
                      J-{daysLeft}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
