'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Users, Hash, Globe, Lock, BadgeCheck, Plus, ArrowLeft,
  LogIn, LogOut, Settings, Zap, MessageSquare, Trash2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { clusterApi, type ClusterDetail, type Channel, type ChannelType } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Create channel modal ──────────────────────────────────────────────────────

function CreateChannelModal({ clusterId, onClose }: { clusterId: string; onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [type, setType] = useState<ChannelType>('ASYNC')
  const [isPrivate, setIsPrivate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => clusterApi.createChannel(clusterId, { name: name.trim(), type, isPrivate }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', clusterId] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6">
        <h2 className="text-base font-semibold mb-4">Créer un channel</h2>

        {error && (
          <p className="text-sm text-destructive mb-3 bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom *</label>
            <input
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ex: annonces, support-clients…"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['ASYNC', 'REALTIME'] as ChannelType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 border rounded-md text-sm transition-colors',
                    type === t
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  {t === 'ASYNC' ? <MessageSquare className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                  <span>
                    <span className="font-medium">{t === 'ASYNC' ? 'Forum' : 'Temps réel'}</span>
                    <span className="block text-[10px] opacity-70">{t === 'ASYNC' ? 'Discussions asynchrones' : 'Chat en direct'}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={cn(
                'h-5 w-9 rounded-full transition-colors relative',
                isPrivate ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                isPrivate ? 'translate-x-4' : 'translate-x-0.5'
              )} />
            </button>
            <span className="text-sm">{isPrivate ? 'Privé — membres invités uniquement' : 'Accessible à tous les membres'}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button
            className="flex-1"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Channel row ───────────────────────────────────────────────────────────────

function ChannelRow({ channel, clusterId, canManage }: { channel: Channel; clusterId: string; canManage: boolean }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const deleteChannel = useMutation({
    mutationFn: () => clusterApi.deleteChannel(clusterId, channel.id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cluster', clusterId] }),
  })

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent group transition-colors">
      <span className={cn(
        'h-7 w-7 rounded-md flex items-center justify-center shrink-0',
        channel.type === 'REALTIME' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 'bg-primary/10 text-primary'
      )}>
        {channel.type === 'REALTIME' ? <Zap className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
      </span>

      <Link href={`/clusters/${clusterId}/channels/${channel.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{channel.name}</span>
          {channel.isPrivate && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
            channel.type === 'REALTIME'
              ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'
              : 'bg-muted text-muted-foreground'
          )}>
            {channel.type === 'REALTIME' ? 'Live' : 'Forum'}
          </span>
        </div>
        {channel.lastMessageAt && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Dernier message {formatDistanceToNow(new Date(channel.lastMessageAt), { addSuffix: true, locale: fr })}
          </p>
        )}
      </Link>

      {canManage && (
        <button
          onClick={(e) => { e.preventDefault(); if (confirm('Supprimer ce channel et tous ses messages ?')) deleteChannel.mutate() }}
          className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClusterDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCreateChannel, setShowCreateChannel] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['cluster', id],
    queryFn: () => clusterApi.get(id, token!),
    enabled: !!token && !!id,
  })

  const cluster = data?.data.cluster as ClusterDetail | undefined

  const join = useMutation({
    mutationFn: () => clusterApi.join(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cluster', id] }),
  })

  const leave = useMutation({
    mutationFn: () => clusterApi.leave(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      router.push('/clusters')
    },
  })

  const deleteCluster = useMutation({
    mutationFn: () => clusterApi.delete(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      router.push('/clusters')
    },
  })

  const canManage = cluster?.role === 'OWNER' || cluster?.role === 'ADMIN'
  const isOwner = cluster?.role === 'OWNER'

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="h-8 w-48 bg-muted/40 rounded animate-pulse" />
        <div className="h-32 bg-muted/40 rounded-xl animate-pulse" />
        <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error || !cluster) {
    return (
      <div className="max-w-3xl text-center py-16">
        <p className="text-sm text-muted-foreground">Cluster introuvable ou accès refusé.</p>
        <Link href="/clusters" className="text-xs text-primary hover:underline mt-2 inline-block">← Retour aux clusters</Link>
      </div>
    )
  }

  const asyncChannels = cluster.channels.filter(c => c.type === 'ASYNC')
  const realtimeChannels = cluster.channels.filter(c => c.type === 'REALTIME')

  return (
    <div className="max-w-3xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/clusters" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Clusters
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{cluster.name}</span>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start gap-4">
          {cluster.avatarUrl ? (
            <img src={cluster.avatarUrl} alt={cluster.name} className="h-14 w-14 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 text-2xl font-bold select-none">
              {cluster.name[0].toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold">{cluster.name}</h1>
              {cluster.isVerified && <BadgeCheck className="h-4 w-4 text-primary" title="Vérifié" />}
              {cluster.role && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                  {cluster.role}
                </span>
              )}
            </div>

            {cluster.description && (
              <p className="text-sm text-muted-foreground mt-1">{cluster.description}</p>
            )}

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {cluster.isPublic
                ? <span className="flex items-center gap-1"><Globe className="h-3 w-3" />Public</span>
                : <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Privé</span>
              }
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{cluster._count.members} membre{cluster._count.members > 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{cluster._count.channels} channel{cluster._count.channels > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {cluster.isPublic && !cluster.isMember && (
              <Button size="sm" className="gap-1.5" disabled={join.isPending} onClick={() => join.mutate()}>
                <LogIn className="h-3.5 w-3.5" />
                Rejoindre
              </Button>
            )}
            {cluster.isMember && !isOwner && (
              <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground" disabled={leave.isPending} onClick={() => leave.mutate()}>
                <LogOut className="h-3.5 w-3.5" />
                Quitter
              </Button>
            )}
            {isOwner && (
              <button
                onClick={() => { if (confirm('Supprimer définitivement ce cluster ?')) deleteCluster.mutate() }}
                className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Supprimer le cluster"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Channels */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Channels</h2>
          {canManage && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowCreateChannel(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nouveau channel
            </Button>
          )}
        </div>

        {cluster.channels.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <Hash className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucun channel</p>
            {canManage && (
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setShowCreateChannel(true)}>
                <Plus className="h-3.5 w-3.5" />
                Créer un channel
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {asyncChannels.length > 0 && (
              <>
                {asyncChannels.length > 0 && realtimeChannels.length > 0 && (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 px-3 py-1">Forum</p>
                )}
                {asyncChannels.map(ch => (
                  <ChannelRow key={ch.id} channel={ch} clusterId={id} canManage={canManage} />
                ))}
              </>
            )}
            {realtimeChannels.length > 0 && (
              <>
                {asyncChannels.length > 0 && realtimeChannels.length > 0 && (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 px-3 py-1 mt-1">Temps réel</p>
                )}
                {realtimeChannels.map(ch => (
                  <ChannelRow key={ch.id} channel={ch} clusterId={id} canManage={canManage} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {showCreateChannel && (
        <CreateChannelModal clusterId={id} onClose={() => setShowCreateChannel(false)} />
      )}
    </div>
  )
}
