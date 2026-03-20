'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { complianceApi } from '@/lib/api'

function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct === 100 ? '#22c55e' : pct > 0 ? '#3b82f6' : '#e5e7eb'

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x="50%" y="50%"
        dominantBaseline="middle" textAnchor="middle"
        className="rotate-90 origin-center"
        style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%', fontSize: 12, fontWeight: 600, fill: '#111827' }}
      >
        {pct}%
      </text>
    </svg>
  )
}

export default function ConformitePage() {
  const { token } = useAuthStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['compliance-progress', token],
    queryFn: () => complianceApi.getProgress(token!),
    enabled: !!token,
  })

  const phases = data?.data.phases ?? []
  const globalProgress = data?.data.globalProgress ?? 0

  return (
    <div className="space-y-6 max-w-3xl">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Conformité</h2>
          <p className="text-muted-foreground mt-1">Suivez votre progression réglementaire par phase.</p>
        </div>
        {!isLoading && (
          <div className="flex flex-col items-center gap-1">
            <ProgressRing pct={globalProgress} size={64} />
            <span className="text-xs text-muted-foreground">Global</span>
          </div>
        )}
      </div>

      {/* États */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">
          Erreur : {(error as Error).message}
        </div>
      )}

      {!isLoading && phases.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Aucune phase configurée</p>
          <p className="text-sm text-muted-foreground mt-1">
            Un administrateur doit configurer les phases et items de conformité.
          </p>
        </div>
      )}

      {/* Liste des phases */}
      <div className="space-y-3">
        {phases.sort((a, b) => a.order - b.order).map((phase) => {
          const { progress } = phase
          const statusColor =
            progress?.status === 'completed' ? 'bg-green-500'
            : progress?.status === 'in_progress' ? 'bg-blue-500'
            : 'bg-muted-foreground/30'

          return (
            <Link
              key={phase.id}
              href={`/conformite/${phase.id}`}
              className="flex items-center gap-4 bg-card border border-border rounded-lg p-5 hover:bg-accent/50 transition-colors group"
            >
              <ProgressRing pct={progress?.percentage ?? 0} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{phase.name}</p>
                  <span className={cn('h-2 w-2 rounded-full shrink-0', statusColor)} />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {progress?.completed ?? 0} / {progress?.total ?? 0} items complétés
                </p>
                {/* Barre de progression */}
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', statusColor)}
                    style={{ width: `${progress?.percentage ?? 0}%` }}
                  />
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
