import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef } from 'react'
import { productApi, type Governance, type GovernanceInput } from '@/lib/api'
import { ALL_MARCHE_CIBLE_FIELDS } from '@/lib/governance-axes'

export function useProductGovernance(productId: string, token: string) {
  const queryClient = useQueryClient()
  const queryKey = ['product-governance', productId, token]
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => productApi.getGovernance(productId, token),
    enabled: !!token && !!productId,
  })

  const active = data?.data.active ?? null
  const draft = data?.data.draft ?? null
  const history = data?.data.history ?? []

  // % champs renseignés sur la gouvernance draft (ou active si pas de draft)
  const completionPercent = useMemo(() => {
    const gov = draft ?? active
    if (!gov) return 0
    const filled = ALL_MARCHE_CIBLE_FIELDS.filter((f) => (gov as Record<string, unknown>)[f] != null).length
    return Math.round((filled / ALL_MARCHE_CIBLE_FIELDS.length) * 100)
  }, [draft, active])

  const isDueForRevision = useMemo(() => {
    if (!active?.nextRevisionDate) return false
    return new Date(active.nextRevisionDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }, [active])

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const createDraftMutation = useMutation({
    mutationFn: (data: GovernanceInput = {}) => productApi.createGovernance(productId, data, token),
    onSuccess: invalidate,
  })

  const updateDraftMutation = useMutation({
    mutationFn: ({ govId, data }: { govId: string; data: GovernanceInput }) =>
      productApi.updateGovernance(productId, govId, data, token),
    onSuccess: invalidate,
  })

  const activateMutation = useMutation({
    mutationFn: (govId: string) => productApi.activateGovernance(productId, govId, token),
    onSuccess: invalidate,
  })

  const reviseMutation = useMutation({
    mutationFn: (govId: string) => productApi.reviseGovernance(productId, govId, token),
    onSuccess: invalidate,
  })

  // Debounced update (1500ms) for form auto-save
  const updateDraftDebounced = useCallback(
    (govId: string, data: GovernanceInput) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        updateDraftMutation.mutate({ govId, data })
      }, 1500)
    },
    [updateDraftMutation]
  )

  const createDraft = async (data?: GovernanceInput) => {
    const res = await createDraftMutation.mutateAsync(data ?? {})
    return res.data.governance
  }

  const updateDraft = async (data: GovernanceInput) => {
    if (!draft) return
    await updateDraftMutation.mutateAsync({ govId: draft.id, data })
  }

  const activateGovernance = async (govId: string) => {
    await activateMutation.mutateAsync(govId)
  }

  const createRevision = async () => {
    if (!active) throw new Error('Aucune gouvernance active à réviser')
    const res = await reviseMutation.mutateAsync(active.id)
    return res.data.governance
  }

  const exportTableau = async () => {
    const res = await productApi.exportGovernance(token)
    if (!res.ok) throw new Error("Erreur lors de l'export")
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const cd = res.headers.get('content-disposition') ?? ''
    const match = cd.match(/filename="([^"]+)"/)
    a.href = url
    a.download = match?.[1] ?? 'gouvernance.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    isLoading,
    active,
    draft,
    history,
    completionPercent,
    isDueForRevision,
    createDraft,
    updateDraft,
    updateDraftDebounced,
    activateGovernance,
    createRevision,
    exportTableau,
    isPending:
      createDraftMutation.isPending ||
      updateDraftMutation.isPending ||
      activateMutation.isPending ||
      reviseMutation.isPending,
    error:
      createDraftMutation.error ||
      updateDraftMutation.error ||
      activateMutation.error ||
      reviseMutation.error,
  }
}

export type GovernanceHook = ReturnType<typeof useProductGovernance>
