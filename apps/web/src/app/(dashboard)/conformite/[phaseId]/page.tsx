'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { complianceApi, type PhaseProgress } from '@/lib/api'
import { StatusBadge } from '@/components/compliance/StatusBadge'
import { AnswerForm } from '@/components/compliance/AnswerForm'

type Item = PhaseProgress['items'][number]

function ItemCard({ item, phaseId }: { item: Item; phaseId: string }) {
  const [open, setOpen] = useState(false)
  const isBlocked = item.status === 'blocked'

  return (
    <div className={cn(
      'bg-card border rounded-lg overflow-hidden transition-colors',
      isBlocked ? 'border-border opacity-60' : 'border-border'
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/40 transition-colors disabled:cursor-not-allowed"
        onClick={() => !isBlocked && setOpen((o) => !o)}
        disabled={isBlocked}
      >
        {isBlocked ? (
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <span className={cn(
            'h-2 w-2 rounded-full shrink-0',
            item.status === 'submitted' ? 'bg-green-500'
            : item.status === 'expiring_soon' ? 'bg-orange-500'
            : item.status === 'expired' ? 'bg-red-500'
            : item.status === 'draft' ? 'bg-blue-400'
            : 'bg-muted-foreground/40'
          )} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{item.label}</span>
            {!(item as unknown as { isRequired: boolean }).isRequired && (
              <span className="text-xs text-muted-foreground">(optionnel)</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={isBlocked ? 'blocked' : item.status} />
            {item.answer?.expiresAt && (
              <span className="text-xs text-muted-foreground">
                Expire le {new Date(item.answer.expiresAt).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
        </div>

        {!isBlocked && (
          open
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Formulaire */}
      {open && !isBlocked && (
        <div className="px-5 pb-5 pt-1 border-t border-border">
          {item.answer?.status === 'submitted' && (
            <p className="text-xs text-muted-foreground mb-3">
              Soumis le {item.answer.expiresAt ? `— expire le ${new Date(item.answer.expiresAt).toLocaleDateString('fr-FR')}` : ''}
            </p>
          )}
          <AnswerForm item={item} phaseId={phaseId} />
        </div>
      )}
    </div>
  )
}

export default function PhaseDetailPage({ params }: { params: { phaseId: string } }) {
  const { token } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['compliance-progress', token],
    queryFn: () => complianceApi.getProgress(token!),
    enabled: !!token,
  })

  const phase = data?.data.phases.find((p) => p.id === params.phaseId)

  const required = phase?.items.filter((i) => (i as unknown as { isRequired: boolean }).isRequired) ?? []
  const optional = phase?.items.filter((i) => !(i as unknown as { isRequired: boolean }).isRequired) ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Retour */}
      <Link href="/conformite" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{phase.name}</h2>
              <p className="text-muted-foreground mt-1">
                {phase.progress?.completed ?? 0} / {phase.progress?.total ?? 0} items complétés
                {' · '}
                <span className="font-medium">{phase.progress?.percentage ?? 0}%</span>
              </p>
            </div>
          </div>

          {/* Items requis */}
          {required.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Items requis ({required.length})
              </h3>
              {required.map((item) => (
                <ItemCard key={item.id} item={item} phaseId={params.phaseId} />
              ))}
            </section>
          )}

          {/* Items optionnels */}
          {optional.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Items optionnels ({optional.length})
              </h3>
              {optional.map((item) => (
                <ItemCard key={item.id} item={item} phaseId={params.phaseId} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
