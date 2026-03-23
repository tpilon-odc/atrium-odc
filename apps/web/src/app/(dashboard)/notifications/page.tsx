'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { AlertTriangle, AlertCircle, CheckCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { notificationApi, type AppNotification } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function NotificationsPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [items, setItems] = useState<AppNotification[]>([])

  const { data, isFetching } = useQuery({
    queryKey: ['notifications-page', token, showAll, cursor],
    queryFn: async () => {
      const res = await notificationApi.list(token!, { all: showAll, cursor })
      setItems((prev) => cursor ? [...prev, ...res.data.notifications] : res.data.notifications)
      return res
    },
    enabled: !!token,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setItems([])
      setCursor(undefined)
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] })
    },
  })

  function handleNotifClick(n: AppNotification) {
    if (!n.isRead) markRead.mutate(n.id)
    const target = n.entityType === 'compliance_phase'
      ? `/conformite/${n.entityId}`
      : '/conformite'
    router.push(target)
  }

  function handleFilterChange(all: boolean) {
    setShowAll(all)
    setCursor(undefined)
    setItems([])
  }

  const unreadCount = data?.data.unreadCount ?? 0
  const nextCursor = data?.data.nextCursor ?? null

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Notifications</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est lu'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Filtre */}
      <div className="flex gap-2">
        {[
          { label: 'Non lues', value: false },
          { label: 'Toutes', value: true },
        ].map(({ label, value }) => (
          <button
            key={String(value)}
            onClick={() => handleFilterChange(value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              showAll === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
        {items.length === 0 && !isFetching && (
          <p className="text-sm text-muted-foreground text-center py-12">
            {showAll ? 'Aucune notification' : 'Aucune notification non lue'}
          </p>
        )}

        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => handleNotifClick(n)}
            className={cn(
              'w-full text-left px-5 py-4 hover:bg-accent transition-colors flex gap-3',
              !n.isRead && 'bg-primary/5'
            )}
          >
            {n.type === 'compliance_expired'
              ? <AlertCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
              : <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{n.title}</p>
                {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
              </p>
            </div>
          </button>
        ))}

        {isFetching && (
          <div className="space-y-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-5 py-4 flex gap-3">
                <div className="h-5 w-5 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {nextCursor && !isFetching && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setCursor(nextCursor)}>
            Charger plus
          </Button>
        </div>
      )}
    </div>
  )
}
