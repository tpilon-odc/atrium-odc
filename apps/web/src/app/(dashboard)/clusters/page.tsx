'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Users, Hash, Globe, Lock, BadgeCheck, Plus, Search, LogIn, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { clusterApi, type Cluster } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Create cluster modal ──────────────────────────────────────────────────────

function CreateClusterModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: (data: Parameters<typeof clusterApi.create>[0]) =>
      clusterApi.create(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6">
        <h2 className="text-base font-semibold mb-4">Créer un cluster</h2>

        {error && (
          <p className="text-sm text-destructive mb-3 bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom *</label>
            <input
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ex: Club immobilier CGP"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={3}
              placeholder="Décrivez l'objet de ce cluster…"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={cn(
                'h-5 w-9 rounded-full transition-colors relative',
                isPublic ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                isPublic ? 'translate-x-4' : 'translate-x-0.5'
              )} />
            </button>
            <span className="text-sm">{isPublic ? 'Public — visible de tous' : 'Privé — sur invitation'}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button
            className="flex-1"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate({ name: name.trim(), description: description.trim() || undefined, isPublic })}
          >
            {create.isPending ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Cluster card ─────────────────────────────────────────────────────────────

function ClusterCard({ cluster }: { cluster: Cluster }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const join = useMutation({
    mutationFn: () => clusterApi.join(cluster.id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clusters'] }),
  })

  const leave = useMutation({
    mutationFn: () => clusterApi.leave(cluster.id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clusters'] }),
  })

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        {cluster.avatarUrl ? (
          <img src={cluster.avatarUrl} alt={cluster.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 text-base font-semibold select-none">
            {cluster.name[0].toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/clusters/${cluster.id}`} className="text-sm font-semibold hover:text-primary transition-colors truncate">
              {cluster.name}
            </Link>
            {cluster.isVerified && (
              <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Vérifié" />
            )}
            {cluster.isMember && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">Membre</span>
            )}
          </div>
          {cluster.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{cluster.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {cluster.isPublic
          ? <span className="flex items-center gap-1"><Globe className="h-3 w-3" />Public</span>
          : <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Privé</span>
        }
        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{cluster._count.members} membre{cluster._count.members > 1 ? 's' : ''}</span>
        <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{cluster._count.channels} channel{cluster._count.channels > 1 ? 's' : ''}</span>
        <span className="ml-auto">{formatDistanceToNow(new Date(cluster.createdAt), { addSuffix: true, locale: fr })}</span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/clusters/${cluster.id}`}
          className="flex-1 h-8 text-xs font-medium bg-primary/5 text-primary hover:bg-primary/10 rounded-md flex items-center justify-center transition-colors"
        >
          Voir le cluster
        </Link>

        {cluster.isPublic && !cluster.isMember && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            disabled={join.isPending}
            onClick={() => join.mutate()}
          >
            <LogIn className="h-3 w-3" />
            Rejoindre
          </Button>
        )}

        {cluster.isMember && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground gap-1"
            disabled={leave.isPending}
            onClick={() => leave.mutate()}
          >
            <LogOut className="h-3 w-3" />
            Quitter
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClustersPage() {
  const { token } = useAuthStore()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['clusters', search],
    queryFn: () => clusterApi.list(token!, { search: search || undefined, limit: 50 }),
    enabled: !!token,
    staleTime: 30_000,
  })

  const clusters = data?.data.clusters ?? []
  const myClusters = clusters.filter(c => c.isMember)
  const otherClusters = clusters.filter(c => !c.isMember)

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Clusters</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Espaces de discussion communautaires entre CGP</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" />
          Créer un cluster
        </Button>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          className="w-full h-9 pl-9 pr-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Rechercher un cluster…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {myClusters.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Mes clusters ({myClusters.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myClusters.map(c => <ClusterCard key={c.id} cluster={c} />)}
              </div>
            </section>
          )}

          {otherClusters.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Découvrir</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {otherClusters.map(c => <ClusterCard key={c.id} cluster={c} />)}
              </div>
            </section>
          )}

          {clusters.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <MessagesSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun cluster trouvé{search ? ' pour cette recherche' : ''}.</p>
              {!search && (
                <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setShowCreate(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Créer le premier cluster
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {showCreate && <CreateClusterModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function MessagesSquare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
