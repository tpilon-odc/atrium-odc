import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contactApi, type ContactProfile } from '@/lib/api'

export function useContactProfile(contactId: string, token: string) {
  const queryClient = useQueryClient()
  const queryKey = ['contact-profile', contactId, token]
  const historyKey = ['contact-profile-history', contactId, token]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => contactApi.getProfile(contactId, token),
    enabled: !!token && !!contactId,
  })

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: historyKey,
    queryFn: () => contactApi.getProfileHistory(contactId, token),
    enabled: !!token && !!contactId,
  })

  const profile = data?.data.profile ?? null
  const history = historyData?.data.history ?? []

  const isDueForReview = (() => {
    if (!profile?.nextReviewDate) return false
    return new Date(profile.nextReviewDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  })()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: historyKey })
  }

  const saveMutation = useMutation({
    mutationFn: (data: Partial<ContactProfile>) => contactApi.saveProfile(contactId, data, token),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ profileId, data }: { profileId: string; data: Partial<ContactProfile> }) =>
      contactApi.updateProfile(contactId, profileId, data, token),
    onSuccess: invalidate,
  })

  // Crée un nouveau profil (archive l'actif)
  const reviseProfile = async (data: Partial<ContactProfile>) => {
    await saveMutation.mutateAsync(data)
  }

  // Enregistre : PUT si profil actif existant, POST sinon
  const saveProfile = async (data: Partial<ContactProfile>) => {
    if (profile) {
      await updateMutation.mutateAsync({ profileId: profile.id, data })
    } else {
      await saveMutation.mutateAsync(data)
    }
  }

  return {
    profile,
    history,
    isLoading,
    isHistoryLoading,
    isDueForReview,
    saveProfile,
    reviseProfile,
    isPending: saveMutation.isPending || updateMutation.isPending,
    error: saveMutation.error || updateMutation.error,
  }
}

export type ContactProfileHook = ReturnType<typeof useContactProfile>
