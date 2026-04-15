'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCheck } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuthStore } from '@/stores/auth'
import { chamberApi, type ChamberFeedPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { FeedPostCard } from '@/components/chamber/PostCard'
import { cn } from '@/lib/utils'

export default function ActualitesPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedPost, setSelectedPost] = useState<ChamberFeedPost | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const { data: catData } = useQuery({
    queryKey: ['chamber-categories', token],
    queryFn: () => chamberApi.getCategories(token!),
    enabled: !!token,
  })
  const categories = catData?.data.categories ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['chamber-feed', token, categoryFilter],
    queryFn: () => chamberApi.getFeed(token!, categoryFilter ?? undefined),
    enabled: !!token,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => chamberApi.markRead(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamber-feed'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = posts.filter((p) => !p.isRead)
      await Promise.all(unread.map((p) => chamberApi.markRead(p.id, token!)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamber-feed'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const posts = data?.data.posts ?? []
  const unreadCount = posts.filter((p) => !p.isRead).length
  const filtered = filter === 'unread' ? posts.filter((p) => !p.isRead) : posts

  function handlePostClick(post: ChamberFeedPost) {
    setSelectedPost(post)
    if (!post.isRead) markReadMutation.mutate(post.id)
  }

  // Vue détail d'un post
  if (selectedPost) {
    const chamberName = [selectedPost.chamber.firstName, selectedPost.chamber.lastName]
      .filter(Boolean).join(' ') || selectedPost.chamber.email

    return (
      <div className="max-w-3xl space-y-6">
        <button
          onClick={() => setSelectedPost(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          Retour aux actualités
        </button>

        <article className="space-y-4">
          <header className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${selectedPost.category.color}20`,
                  color: selectedPost.category.color,
                }}
              >
                {selectedPost.category.name}
              </span>
              <span className="font-medium text-foreground">{chamberName}</span>
              <span>·</span>
              {selectedPost.publishedAt && (
                <time dateTime={selectedPost.publishedAt}>
                  {format(new Date(selectedPost.publishedAt), 'dd MMMM yyyy', { locale: fr })}
                </time>
              )}
            </div>
            <h1 className="text-2xl font-semibold leading-tight">{selectedPost.title}</h1>
          </header>

          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: selectedPost.content }}
          />
        </article>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Actualités</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Communications publiées par les chambres professionnelles.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Filtre lu/non-lu */}
      <div className="flex gap-2">
        {[
          { label: `Non lues${unreadCount > 0 ? ` (${unreadCount})` : ''}`, value: 'unread' as const },
          { label: 'Toutes', value: 'all' as const },
        ].map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              filter === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtre catégories */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter(null)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              categoryFilter === null
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:bg-muted/50'
            )}
          >
            Toutes les catégories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id === categoryFilter ? null : cat.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border-2 transition-all',
                categoryFilter === cat.id ? 'text-white' : 'text-muted-foreground hover:bg-muted/50 border-border'
              )}
              style={categoryFilter === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle"
                style={{ backgroundColor: categoryFilter === cat.id ? 'rgba(255,255,255,0.7)' : cat.color }}
              />
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
              <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
              <div className="h-3 bg-muted animate-pulse rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center border rounded-lg">
          {filter === 'unread'
            ? 'Tout est à jour — aucune communication non lue.'
            : 'Aucune communication publiée pour l\'instant.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              onRead={(id) => markReadMutation.mutate(id)}
              onClick={handlePostClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
