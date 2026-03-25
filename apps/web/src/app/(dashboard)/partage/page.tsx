'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Share2, Trash2, Plus, X, ArrowUpRight, ArrowDownLeft, Eye, EyeOff, Activity } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { shareApi, type Share, type ShareWithViewLog } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ENTITY_LABELS: Record<string, string> = {
  contact: 'Contact',
  document: 'Document',
  collaborator_training: 'Formation',
  cabinet_compliance: 'Conformité cabinet',
  cabinet: 'Cabinet complet',
  compliance_item: 'Item de conformité',
}

function ShareRow({ share, onRevoke }: { share: Share; onRevoke?: () => void }) {
  const who = share.recipientUser?.email ?? share.granterUser?.email ?? '—'
  const cabinetName = share.cabinet?.name

  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-lg px-4 py-3 group">
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Share2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {ENTITY_LABELS[share.entityType] ?? share.entityType}
          {share.entityId && <span className="text-xs text-muted-foreground ml-2 font-normal">(entité spécifique)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {cabinetName ? `De : ${cabinetName} (${who})` : `Avec : ${who}`}
          {' · '}{new Date(share.createdAt).toLocaleDateString('fr-FR')}
        </p>
      </div>
      {onRevoke && (
        <button
          onClick={() => confirm('Révoquer ce partage ?') && onRevoke()}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
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
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Ce que vous partagez</Label>
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          {Object.entries(ENTITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">ID de l'utilisateur destinataire</Label>
        <Input
          value={grantedTo}
          onChange={(e) => setGrantedTo(e.target.value)}
          placeholder="UUID de l'utilisateur…"
          className="text-sm font-mono"
        />
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

// ── Ligne activité ─────────────────────────────────────────────────────────

function ActivityRow({ share, onRevoke }: { share: ShareWithViewLog; onRevoke: () => void }) {
  const lastView = share.viewLogs[0]
  const viewed = !!lastView

  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-lg px-4 py-3 group">
      <div className={cn(
        'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
        viewed ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
      )}>
        {viewed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {ENTITY_LABELS[share.entityType] ?? share.entityType}
          {share.entityId && <span className="text-xs text-muted-foreground ml-1.5 font-normal">· entité spécifique</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          Partagé avec <span className="font-medium">{share.recipientUser.email}</span>
          {' · '}{new Date(share.createdAt).toLocaleDateString('fr-FR')}
        </p>
      </div>

      <div className="text-right shrink-0">
        {viewed ? (
          <p className="text-xs text-success font-medium">
            Consulté le {new Date(lastView.viewedAt).toLocaleDateString('fr-FR')} à {new Date(lastView.viewedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Jamais consulté</p>
        )}
      </div>

      <button
        onClick={() => confirm('Révoquer ce partage ?') && onRevoke()}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function PartagePage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'granted' | 'received' | 'activity'>('granted')
  const [adding, setAdding] = useState(false)

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

  const isLoading = tab === 'granted' ? loadingGranted : tab === 'received' ? loadingReceived : loadingActivity

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Partage</h2>
          <p className="text-muted-foreground mt-1">Partagez vos données avec d'autres cabinets.</p>
        </div>
        {tab === 'granted' && !adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau partage
          </Button>
        )}
      </div>

      {adding && <CreateShareForm onClose={() => setAdding(false)} />}

      {/* Onglets */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: 'granted', label: 'Accordés', icon: ArrowUpRight, count: granted.length },
          { key: 'received', label: 'Reçus', icon: ArrowDownLeft, count: received.length },
          { key: 'activity', label: 'Activité', icon: Activity, count: null },
        ].map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
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
      ) : tab === 'activity' ? (
        activity.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Aucun partage actif</p>
            <p className="text-sm text-muted-foreground mt-1">Les consultations de vos partages apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activity
              .sort((a, b) => {
                const aViewed = a.viewLogs[0]?.viewedAt ?? ''
                const bViewed = b.viewLogs[0]?.viewedAt ?? ''
                return bViewed.localeCompare(aViewed)
              })
              .map((share) => (
                <ActivityRow
                  key={share.id}
                  share={share}
                  onRevoke={() => revokeMutation.mutate(share.id)}
                />
              ))}
          </div>
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
      ) : (
        <div className="space-y-2">
          {(tab === 'granted' ? granted : received).map((share) => (
            <ShareRow
              key={share.id}
              share={share}
              onRevoke={tab === 'granted' ? () => revokeMutation.mutate(share.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
