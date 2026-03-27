import { useQuery } from '@tanstack/react-query'
import { contactApi, type AdequacyResult } from '@/lib/api'
import { useMemo } from 'react'

export type AdequacyRow = {
  product: { id: string; name: string; category: string | null }
  governance: Record<string, unknown>
  adequacy: AdequacyResult
}

export function useContactAdequacy(contactId: string, token: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['contact-adequacy', contactId, token],
    queryFn: () => contactApi.getAdequacy(contactId, token),
    enabled: !!token && !!contactId,
  })

  const results: AdequacyRow[] = data?.data.results ?? []
  const hasProfile = data?.data.hasProfile ?? false

  const summary = useMemo(() => {
    return {
      positive: results.filter((r) => r.adequacy.global === 'positif').length,
      neutral: results.filter((r) => r.adequacy.global === 'neutre').length,
      negative: results.filter((r) => r.adequacy.global === 'negatif').length,
    }
  }, [results])

  return { results, isLoading, hasProfile, summary }
}
