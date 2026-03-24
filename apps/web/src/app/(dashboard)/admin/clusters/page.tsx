'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Flag, CheckCircle2, XCircle, ExternalLink, MessageSquare } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminClusterApi, displayName, type MessageReport } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATUS_TABS = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'REVIEWED', label: 'Traités' },
  { value: 'DISMISSED', label: 'Ignorés' },
] as const

function ReportCard({ report }: { report: MessageReport }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: (status: 'REVIEWED' | 'DISMISSED') =>
      adminClusterApi.updateReport(report.id, status, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
    },
  })

  const isPending = report.status === 'PENDING'

  return (
    <div className={cn(
      'bg-card border border-border rounded-xl p-4 space-y-3',
      isPending && 'border-warning/40'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Flag className="h-3 w-3 text-warning" />
            <span>Signalé par <strong>{displayName(report.reporter)}</strong></span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(report.createdAt), { addSuffix: true, locale: fr })}</span>
          </div>
          <div className="mt-1 text-xs">
            <span className="text-muted-foreground">Dans </span>
            <Link
              href={`/clusters/${report.message.channel.cluster.id}/channels/${report.message.channel.id}`}
              className="text-primary hover:underline font-medium"
            >
              {report.message.channel.cluster.name} / #{report.message.channel.name}
            </Link>
            <ExternalLink className="inline h-3 w-3 ml-0.5 text-muted-foreground" />
          </div>
        </div>

        <span className={cn(
          'text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0',
          report.status === 'PENDING' && 'bg-warning/15 text-warning',
          report.status === 'REVIEWED' && 'bg-success/15 text-success',
          report.status === 'DISMISSED' && 'bg-muted text-muted-foreground',
        )}>
          {report.status === 'PENDING' ? 'En attente' : report.status === 'REVIEWED' ? 'Traité' : 'Ignoré'}
        </span>
      </div>

      {/* Raison */}
      <div className="bg-muted/40 rounded-md px-3 py-2 text-xs">
        <span className="text-muted-foreground font-medium">Raison : </span>
        <span>{report.reason}</span>
      </div>

      {/* Message signalé */}
      <div className={cn(
        'rounded-md px-3 py-2 text-sm border',
        report.message.deletedAt
          ? 'bg-destructive/5 border-destructive/20 text-muted-foreground italic'
          : 'bg-background border-border'
      )}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <MessageSquare className="h-3 w-3" />
          <strong>{displayName(report.message.authorUser)}</strong>
          <span>·</span>
          <span>{report.message.authorCabinet.name}</span>
          {report.message.deletedAt && (
            <span className="text-destructive font-medium">· supprimé</span>
          )}
        </div>
        <p className="line-clamp-4 whitespace-pre-wrap break-words">{report.message.content}</p>
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
            disabled={update.isPending}
            onClick={() => {
              if (confirm('Supprimer le message et marquer le signalement comme traité ?')) {
                update.mutate('REVIEWED')
              }
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Supprimer le message
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-muted-foreground"
            disabled={update.isPending}
            onClick={() => update.mutate('DISMISSED')}
          >
            <XCircle className="h-3.5 w-3.5" />
            Ignorer
          </Button>
        </div>
      )}
    </div>
  )
}

export default function AdminClustersPage() {
  const { token } = useAuthStore()
  const [status, setStatus] = useState<string>('PENDING')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', status],
    queryFn: () => adminClusterApi.listReports(token!, status),
    enabled: !!token,
  })

  const reports = data?.data.reports ?? []

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold">Modération — Clusters</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Signalements de messages par les membres</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              status === tab.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun signalement {status === 'PENDING' ? 'en attente' : status === 'REVIEWED' ? 'traité' : 'ignoré'}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  )
}
