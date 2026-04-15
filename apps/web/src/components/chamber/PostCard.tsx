'use client'

import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CheckCheck, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export interface FeedPost {
  id: string
  title: string
  content: string
  publishedAt: string | null
  createdAt: string
  isRead: boolean
  readAt: string | null
  chamber: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    avatarUrl: string | null
  }
}

export interface OwnPost {
  id: string
  title: string
  content: string
  status: 'draft' | 'published'
  publishedAt: string | null
  createdAt: string
  _count: { reads: number }
}

interface FeedPostCardProps {
  post: FeedPost
  onRead: (id: string) => void
  onClick: (post: FeedPost) => void
}

export function FeedPostCard({ post, onRead, onClick }: FeedPostCardProps) {
  const chamberName = [post.chamber.firstName, post.chamber.lastName].filter(Boolean).join(' ')
    || post.chamber.email

  const handleClick = () => {
    if (!post.isRead) onRead(post.id)
    onClick(post)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left rounded-lg border p-4 transition-colors hover:bg-muted/40 group',
        !post.isRead && 'border-primary/30 bg-primary/5'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {!post.isRead && (
              <span className="inline-block w-2 h-2 rounded-full bg-primary shrink-0" />
            )}
            <span className="text-xs text-muted-foreground">{chamberName}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {post.publishedAt
                ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true, locale: fr })
                : '—'}
            </span>
          </div>
          <h3 className={cn('font-medium text-sm leading-snug truncate', !post.isRead && 'text-foreground font-semibold')}>
            {post.title}
          </h3>
          <div
            className="text-xs text-muted-foreground mt-1 line-clamp-2 prose-preview"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </div>
        {post.isRead && (
          <CheckCheck size={14} className="text-muted-foreground shrink-0 mt-0.5" />
        )}
      </div>
    </button>
  )
}

interface OwnPostCardProps {
  post: OwnPost
  onEdit: (post: OwnPost) => void
  onDelete: (id: string) => void
  onPublish: (id: string) => void
}

export function OwnPostCard({ post, onEdit, onDelete, onPublish }: OwnPostCardProps) {
  return (
    <div className="rounded-lg border p-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={post.status === 'published' ? 'default' : 'secondary'} className="text-xs">
            {post.status === 'published' ? 'Publié' : 'Brouillon'}
          </Badge>
          {post.status === 'published' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCheck size={12} /> {post._count.reads} lecture{post._count.reads !== 1 ? 's' : ''}
            </span>
          )}
          {post.status === 'draft' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={12} /> Brouillon
            </span>
          )}
        </div>
        <h3 className="font-medium text-sm">{post.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {post.publishedAt
            ? `Publié ${formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true, locale: fr })}`
            : `Créé ${formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: fr })}`}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {post.status === 'draft' && (
          <button
            onClick={() => onPublish(post.id)}
            className="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Publier
          </button>
        )}
        <button
          onClick={() => onEdit(post)}
          className="text-xs px-2 py-1 rounded-md border hover:bg-muted transition-colors"
        >
          Modifier
        </button>
        <button
          onClick={() => onDelete(post.id)}
          className="text-xs px-2 py-1 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
        >
          Supprimer
        </button>
      </div>
    </div>
  )
}
