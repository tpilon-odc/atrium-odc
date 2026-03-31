'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Loader2, AlertTriangle, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminGdprApi, type GdprRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  DONE: 'Traitée',
  REJECTED: 'Refusée',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
  PROCESSING: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
  DONE: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
  REJECTED: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3.5 w-3.5" />,
  PROCESSING: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  DONE: <CheckCircle2 className="h-3.5 w-3.5" />,
  REJECTED: <XCircle className="h-3.5 w-3.5" />,
}

function RequestRow({ request }: { request: GdprRequest }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [response, setResponse] = useState(request.response ?? '')
  const [action, setAction] = useState<'PROCESSING' | 'DONE' | 'REJECTED' | null>(null)

  const mutation = useMutation({
    mutationFn: (status: 'PROCESSING' | 'DONE' | 'REJECTED') =>
      adminGdprApi.updateRequest(request.id, status, response || undefined, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gdpr-requests'] })
      setAction(null)
    },
  })

  const isActive = request.status === 'PENDING' || request.status === 'PROCESSING'

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* En-tête ligne */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm truncate">{request.cabinet?.name ?? '—'}</span>
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0',
              STATUS_COLORS[request.status]
            )}>
              {STATUS_ICONS[request.status]}
              {STATUS_LABELS[request.status]}
            </span>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {request.type === 'ACCESS' ? 'Accès' : 'Effacement'}
          </span>
          <span className="text-xs text-muted-foreground col-span-2">
            {request.requester?.email ?? '—'} · {new Date(request.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {/* Détail */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-4">
          {request.message && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Message du cabinet</p>
              <p className="text-sm bg-background border border-border rounded-md px-3 py-2">{request.message}</p>
            </div>
          )}

          {request.type === 'ACCESS' && isActive && (
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2">
              Cliquer sur &quot;Lancer export&quot; va mettre la demande en PROCESSING — le job générera le ZIP et enverra l&apos;email automatiquement.
            </div>
          )}

          {request.type === 'ERASURE' && isActive && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Lancer l&apos;effacement supprimera définitivement toutes les données privées du cabinet.</span>
            </div>
          )}

          {/* Note interne */}
          {isActive && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Note interne (optionnelle)</label>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={2}
                placeholder="Visible par le cabinet si refus..."
                className="w-full text-xs border border-input rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {mutation.isError && (
            <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
          )}

          {/* Actions */}
          {isActive && (
            <div className="flex items-center gap-2 flex-wrap">
              {request.type === 'ACCESS' && request.status === 'PENDING' && (
                <Button
                  size="sm"
                  onClick={() => { setAction('PROCESSING'); mutation.mutate('PROCESSING') }}
                  disabled={mutation.isPending && action === 'PROCESSING'}
                >
                  {mutation.isPending && action === 'PROCESSING' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Lancer l&apos;export
                </Button>
              )}
              {request.type === 'ERASURE' && request.status === 'PENDING' && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => { setAction('PROCESSING'); mutation.mutate('PROCESSING') }}
                  disabled={mutation.isPending && action === 'PROCESSING'}
                >
                  {mutation.isPending && action === 'PROCESSING' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Lancer l&apos;effacement
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setAction('REJECTED'); mutation.mutate('REJECTED') }}
                disabled={mutation.isPending}
              >
                {mutation.isPending && action === 'REJECTED' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Refuser
              </Button>
            </div>
          )}

          {/* Résultat */}
          {request.status === 'DONE' && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Traitée le {request.processedAt ? new Date(request.processedAt).toLocaleDateString('fr-FR') : '—'}</span>
            </div>
          )}
          {request.status === 'REJECTED' && request.response && (
            <p className="text-xs text-muted-foreground">Motif : {request.response}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminRgpdPage() {
  const { token } = useAuthStore()
  const [filter, setFilter] = useState<'active' | 'all'>('active')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-gdpr-requests', filter],
    queryFn: () => filter === 'all'
      ? adminGdprApi.listRequests(token!, undefined)
      : adminGdprApi.listRequests(token!),
    enabled: !!token,
    refetchInterval: 10_000, // Rafraîchit toutes les 10s si un job tourne
  })

  const requests = (data?.data ?? []) as GdprRequest[]
  const pending = requests.filter((r) => r.status === 'PENDING')
  const processing = requests.filter((r) => r.status === 'PROCESSING')
  const done = requests.filter((r) => r.status !== 'PENDING' && r.status !== 'PROCESSING')

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Demandes RGPD
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Gérez les demandes d&apos;accès aux données et d&apos;effacement des cabinets.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1 bg-muted/30">
          {(['active', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                filter === f ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f === 'active' ? 'En cours' : 'Toutes'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      )}

      {!isLoading && requests.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Aucune demande {filter === 'active' ? 'en cours' : ''}.
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> En attente ({pending.length})
          </h3>
          {pending.map((r) => <RequestRow key={r.id} request={r} />)}
        </section>
      )}

      {processing.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> En cours ({processing.length})
          </h3>
          {processing.map((r) => <RequestRow key={r.id} request={r} />)}
        </section>
      )}

      {filter === 'all' && done.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Traitées ({done.length})
          </h3>
          {done.map((r) => <RequestRow key={r.id} request={r} />)}
        </section>
      )}
    </div>
  )
}
