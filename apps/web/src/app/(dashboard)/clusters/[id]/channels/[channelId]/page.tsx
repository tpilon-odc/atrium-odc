'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft, Hash, Zap, Send, Pencil, Trash2, Flag, CornerDownRight,
  X, SmilePlus, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { clusterApi, messageApi, type ClusterMessage, type Channel } from '@/lib/api'
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { displayName } from '@/lib/api'

// ── Emoji picker (simple) ─────────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '✅']

function EmojiPicker({ onSelect }: { onSelect: (e: string) => void }) {
  return (
    <div className="absolute bottom-full mb-1 left-0 bg-card border border-border rounded-lg shadow-lg p-1.5 flex gap-1 z-10">
      {QUICK_EMOJIS.map(e => (
        <button
          key={e}
          onClick={() => onSelect(e)}
          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-base transition-colors"
        >
          {e}
        </button>
      ))}
    </div>
  )
}

// ── Author avatar ─────────────────────────────────────────────────────────────

function AuthorAvatar({ user }: { user: ClusterMessage['authorUser'] }) {
  const name = displayName(user)
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={name} className="h-7 w-7 rounded-full object-cover shrink-0" />
  }
  const initials = name.includes(' ')
    ? name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return (
    <div className="h-7 w-7 rounded-full bg-primary/15 text-primary text-[11px] font-semibold flex items-center justify-center shrink-0 select-none">
      {initials}
    </div>
  )
}

// ── Reactions bar ─────────────────────────────────────────────────────────────

function ReactionsBar({
  message,
  currentUserId,
  onReact,
}: {
  message: ClusterMessage
  currentUserId: string
  onReact: (emoji: string) => void
}) {
  const grouped = message.reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false }
    acc[r.emoji].count++
    if (r.userId === currentUserId) acc[r.emoji].mine = true
    return acc
  }, {})

  if (Object.keys(grouped).length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {Object.entries(grouped).map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
            mine
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-background hover:bg-accent'
          )}
        >
          <span>{emoji}</span>
          <span className="font-medium">{count}</span>
        </button>
      ))}
    </div>
  )
}

// ── Single message ────────────────────────────────────────────────────────────

function MessageItem({
  message,
  currentUserId,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onReport,
  isReply = false,
}: {
  message: ClusterMessage
  currentUserId: string
  onReact: (messageId: string, emoji: string) => void
  onReply?: (message: ClusterMessage) => void
  onEdit: (message: ClusterMessage) => void
  onDelete: (messageId: string) => void
  onReport: (messageId: string) => void
  isReply?: boolean
}) {
  const [showEmoji, setShowEmoji] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const isDeleted = !!message.deletedAt
  const isAuthor = message.authorUserId === currentUserId

  return (
    <div className={cn('group flex gap-2.5', isReply && 'ml-9')}>
      <AuthorAvatar user={message.authorUser} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs font-semibold">{displayName(message.authorUser)}</span>
          <span className="text-[10px] text-muted-foreground">{message.authorCabinet.name}</span>
          <span className="text-[10px] text-muted-foreground/60">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true, locale: fr })}
          </span>
          {message.updatedAt !== message.createdAt && !isDeleted && (
            <span className="text-[10px] text-muted-foreground/50 italic">(modifié)</span>
          )}
        </div>

        <p className={cn(
          'text-sm mt-0.5 whitespace-pre-wrap break-words',
          isDeleted && 'text-muted-foreground italic'
        )}>
          {message.content}
        </p>

        {!isDeleted && (
          <ReactionsBar
            message={message}
            currentUserId={currentUserId}
            onReact={(emoji) => onReact(message.id, emoji)}
          />
        )}

        {/* Replies count */}
        {!isReply && message._count.replies > 0 && (
          <button
            onClick={() => setShowReplies(v => !v)}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-1.5"
          >
            <CornerDownRight className="h-3 w-3" />
            {message._count.replies} réponse{message._count.replies > 1 ? 's' : ''}
            {showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}

        {showReplies && !isReply && (
          <RepliesThread
            parentMessage={message}
            currentUserId={currentUserId}
            onReact={onReact}
            onEdit={onEdit}
            onDelete={onDelete}
            onReport={onReport}
          />
        )}
      </div>

      {/* Actions hover */}
      {!isDeleted && (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0 self-start mt-0.5">
          <div className="relative">
            <button
              onClick={() => setShowEmoji(v => !v)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
              title="Réagir"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
            {showEmoji && (
              <EmojiPicker onSelect={(e) => { onReact(message.id, e); setShowEmoji(false) }} />
            )}
          </div>
          {!isReply && onReply && (
            <button
              onClick={() => onReply(message)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
              title="Répondre"
            >
              <CornerDownRight className="h-3.5 w-3.5" />
            </button>
          )}
          {isAuthor && (
            <button
              onClick={() => onEdit(message)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
              title="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {isAuthor && (
            <button
              onClick={() => { if (confirm('Supprimer ce message ?')) onDelete(message.id) }}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {!isAuthor && (
            <button
              onClick={() => onReport(message.id)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-warning hover:bg-warning/10"
              title="Signaler"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Replies thread ────────────────────────────────────────────────────────────

function RepliesThread({
  parentMessage,
  currentUserId,
  onReact,
  onEdit,
  onDelete,
  onReport,
}: {
  parentMessage: ClusterMessage
  currentUserId: string
  onReact: (messageId: string, emoji: string) => void
  onEdit: (message: ClusterMessage) => void
  onDelete: (messageId: string) => void
  onReport: (messageId: string) => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [replyContent, setReplyContent] = useState('')

  const { data } = useQuery({
    queryKey: ['messages', parentMessage.channelId, parentMessage.id],
    queryFn: () => messageApi.list(parentMessage.channelId, token!, { parentId: parentMessage.id, limit: 50 }),
    enabled: !!token,
  })

  const replies = data?.data.messages ?? []

  const sendReply = useMutation({
    mutationFn: () => messageApi.create(parentMessage.channelId, { content: replyContent.trim(), parentId: parentMessage.id }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', parentMessage.channelId] })
      setReplyContent('')
    },
  })

  return (
    <div className="mt-2 border-l-2 border-border pl-3 space-y-3">
      {replies.map(r => (
        <MessageItem
          key={r.id}
          message={r}
          currentUserId={currentUserId}
          onReact={onReact}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
          isReply
        />
      ))}
      <div className="flex gap-2 mt-2">
        <input
          className="flex-1 h-8 px-2.5 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
          placeholder="Répondre…"
          value={replyContent}
          onChange={e => setReplyContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && replyContent.trim()) { e.preventDefault(); sendReply.mutate() } }}
        />
        <Button size="sm" className="h-8 w-8 p-0" disabled={!replyContent.trim() || sendReply.isPending} onClick={() => sendReply.mutate()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── Report modal ──────────────────────────────────────────────────────────────

function ReportModal({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const { token } = useAuthStore()
  const [reason, setReason] = useState('')

  const report = useMutation({
    mutationFn: () => messageApi.report(messageId, reason.trim(), token!),
    onSuccess: onClose,
  })

  return (
    <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm p-5">
        <h2 className="text-sm font-semibold mb-3">Signaler ce message</h2>
        <textarea
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          rows={3}
          placeholder="Décrivez la raison du signalement…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button size="sm" className="flex-1" disabled={!reason.trim() || report.isPending} onClick={() => report.mutate()}>
            {report.isPending ? 'Envoi…' : 'Signaler'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChannelPage() {
  const { id: clusterId, channelId } = useParams<{ id: string; channelId: string }>()
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [content, setContent] = useState('')
  const [editingMessage, setEditingMessage] = useState<ClusterMessage | null>(null)
  const [replyTo, setReplyTo] = useState<ClusterMessage | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)

  // Load cluster to get channel info
  const { data: clusterData } = useQuery({
    queryKey: ['cluster', clusterId],
    queryFn: () => clusterApi.get(clusterId, token!),
    enabled: !!token && !!clusterId,
  })
  const cluster = clusterData?.data.cluster
  const channel = cluster?.channels.find(c => c.id === channelId) as Channel | undefined

  // Load messages — polling every 30s for ASYNC, Realtime handles REALTIME
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', channelId],
    queryFn: () => messageApi.list(channelId, token!, { limit: 50 }),
    enabled: !!token && !!channelId,
    refetchInterval: channel?.type === 'ASYNC' ? 30_000 : false,
  })
  const messages = messagesData?.data.messages ?? []

  // Realtime subscription for REALTIME channels
  useRealtimeChannel(channelId, channel?.type ?? 'ASYNC')

  // Auto-scroll to bottom on new messages in REALTIME mode
  useEffect(() => {
    if (channel?.type === 'REALTIME') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, channel?.type])

  const sendMessage = useMutation({
    mutationFn: () => messageApi.create(channelId, {
      content: content.trim(),
      parentId: replyTo?.id,
    }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] })
      setContent('')
      setReplyTo(null)
    },
  })

  const updateMessage = useMutation({
    mutationFn: () => messageApi.update(editingMessage!.id, editingMessage!.content, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] })
      setEditingMessage(null)
    },
  })

  const deleteMessage = useMutation({
    mutationFn: (messageId: string) => messageApi.delete(messageId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', channelId] }),
  })

  const react = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      // Si l'utilisateur a déjà une réaction différente sur ce message, la retirer d'abord
      const cached = queryClient.getQueryData<{ data: { messages: ClusterMessage[] } }>(['messages', channelId])
      const msg = cached?.data.messages.find(m => m.id === messageId)
      const existingEmoji = msg?.reactions.find(r => r.userId === user?.id && r.emoji !== emoji)?.emoji
      if (existingEmoji) {
        await messageApi.react(messageId, existingEmoji, token!)
      }
      return messageApi.react(messageId, emoji, token!)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', channelId] }),
  })

  const isRealtime = channel?.type === 'REALTIME'
  const topLevelMessages = messages.filter(m => !m.parentId)

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-5rem)] max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
        <Link
          href={`/clusters/${clusterId}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <span className={cn(
          'h-7 w-7 rounded-md flex items-center justify-center',
          isRealtime ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 'bg-primary/10 text-primary'
        )}>
          {isRealtime ? <Zap className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold">{channel?.name ?? '…'}</h1>
            {cluster && (
              <span className="text-xs text-muted-foreground">— {cluster.name}</span>
            )}
          </div>
          {isRealtime && (
            <p className="text-[10px] text-orange-500 font-medium">● Temps réel</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className={cn(
        'flex-1 overflow-y-auto py-4 space-y-4',
        isRealtime && 'flex flex-col'
      )}>
        {isLoading ? (
          <div className="space-y-4 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="h-7 w-7 rounded-full bg-muted/40 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-muted/40 rounded animate-pulse" />
                  <div className="h-4 w-64 bg-muted/40 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : topLevelMessages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
            <div>
              {isRealtime
                ? <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                : <Hash className="h-8 w-8 mx-auto mb-2 opacity-30" />
              }
              <p className="text-sm">Aucun message pour l'instant.</p>
              <p className="text-xs mt-1">Soyez le premier à écrire !</p>
            </div>
          </div>
        ) : (
          topLevelMessages.map(msg => (
            <MessageItem
              key={msg.id}
              message={msg}
              currentUserId={user?.id ?? ''}
              onReact={(msgId, emoji) => react.mutate({ messageId: msgId, emoji })}
              onReply={setReplyTo}
              onEdit={setEditingMessage}
              onDelete={(msgId) => deleteMessage.mutate(msgId)}
              onReport={setReportingId}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border pt-3 shrink-0">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-muted/40 rounded-md text-xs text-muted-foreground">
            <CornerDownRight className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate">Répondre à <strong>{displayName(replyTo.authorUser)}</strong> : {replyTo.content}</span>
            <button onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></button>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none min-h-[38px] max-h-32"
            placeholder={`Message dans #${channel?.name ?? '…'}`}
            rows={1}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && content.trim()) {
                e.preventDefault()
                sendMessage.mutate()
              }
            }}
          />
          <Button
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
            disabled={!content.trim() || sendMessage.isPending}
            onClick={() => sendMessage.mutate()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1 px-1">Entrée pour envoyer · Maj+Entrée pour sauter une ligne</p>
      </div>

      {/* Edit modal */}
      {editingMessage && (
        <div className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-5">
            <h2 className="text-sm font-semibold mb-3">Modifier le message</h2>
            <textarea
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={4}
              value={editingMessage.content}
              onChange={e => setEditingMessage({ ...editingMessage, content: e.target.value })}
            />
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingMessage(null)}>Annuler</Button>
              <Button size="sm" className="flex-1" disabled={!editingMessage.content.trim() || updateMessage.isPending} onClick={() => updateMessage.mutate()}>
                {updateMessage.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {reportingId && (
        <ReportModal messageId={reportingId} onClose={() => setReportingId(null)} />
      )}
    </div>
  )
}
