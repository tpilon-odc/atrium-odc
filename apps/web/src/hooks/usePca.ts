'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { pcaApi, PcaData } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const DEBOUNCE_MS = 1500

export function usePca() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['pca', token],
    queryFn: () => pcaApi.get(token!),
    enabled: !!token,
    staleTime: Infinity,
  })

  const pca = data?.data.pca

  const saveMutation = useMutation({
    mutationFn: (pcaData: PcaData) => pcaApi.save(pcaData, token!),
  })

  const completeMutation = useMutation({
    mutationFn: (completed: boolean) => pcaApi.setCompleted(completed, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pca', token] })
    },
  })

  // Ref stable vers saveMutation.mutate — ne change jamais de référence
  const saveMutateRef = useRef(saveMutation.mutate)
  saveMutateRef.current = saveMutation.mutate

  const saveDebounced = useRef((pcaData: PcaData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveMutateRef.current(pcaData)
    }, DEBOUNCE_MS)
  }).current

  const saveNow = useRef((pcaData: PcaData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveMutateRef.current(pcaData)
  }).current

  return {
    pca,
    isLoading,
    isSaving: saveMutation.isPending,
    saveDebounced,
    saveNow,
    setCompleted: completeMutation.mutate,
    isMarkingComplete: completeMutation.isPending,
  }
}
