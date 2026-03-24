'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

type ChannelType = 'ASYNC' | 'REALTIME'

/**
 * S'abonne aux événements Supabase Realtime d'un channel de type REALTIME.
 * Invalide automatiquement le cache TanStack Query sur chaque événement reçu.
 * Sans effet pour les channels ASYNC (polling toutes les 30s via refetchInterval).
 * Le client Supabase est créé de façon lazy — uniquement si type === 'REALTIME'.
 */
export function useRealtimeChannel(channelId: string | null, type: ChannelType) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!channelId || type !== 'REALTIME') return

    const supabase = createClient()
    const channel = supabase.channel(`channel:${channelId}`)

    channel
      .on('broadcast', { event: 'message:new' }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', channelId] })
      })
      .on('broadcast', { event: 'message:delete' }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', channelId] })
      })
      .on('broadcast', { event: 'reaction:toggle' }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', channelId] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId, type, queryClient])
}
