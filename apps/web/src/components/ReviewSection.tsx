'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Review {
  id: string
  rating: number
  comment: string
  createdAt: string
  cabinet: { id: string; name: string }
}

interface Props {
  entityType: 'product' | 'supplier'
  entityId: string
  token: string
  cabinetId: string
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="text-yellow-400 hover:scale-110 transition-transform"
        >
          <Star className={cn('h-5 w-5', (hover || value) >= n ? 'fill-yellow-400' : 'fill-none')} />
        </button>
      ))}
    </div>
  )
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-3.5 w-3.5 text-yellow-400', value >= n ? 'fill-yellow-400' : 'fill-none')} />
      ))}
    </div>
  )
}

export function ReviewSection({ entityType, entityId, token, cabinetId }: Props) {
  const queryClient = useQueryClient()
  const apiPath = `/api/v1/${entityType}s/${entityId}/reviews`
  const queryKey = ['reviews', entityType, entityId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${apiPath}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erreur chargement avis')
      return res.json() as Promise<{ data: { reviews: Review[]; myReview: Review | null } }>
    },
    enabled: !!token,
  })

  const reviews = data?.data.reviews ?? []
  const myReview = data?.data.myReview ?? null

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [initialized, setInitialized] = useState(false)

  // Pre-fill form once myReview loads
  if (myReview && !initialized) {
    setRating(myReview.rating)
    setComment(myReview.comment)
    setInitialized(true)
  }
  if (!myReview && initialized) {
    setInitialized(false)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/${entityType}s/${entityId}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rating, comment }),
        }
      )
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Erreur')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const canSubmit = rating >= 1 && rating <= 5 && comment.trim().length > 0

  const avg = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Avis de la communauté</h3>
        {avg !== null && (
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold">{avg.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">/ 5 ({reviews.length} avis)</span>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="space-y-3 border-b border-border pb-5">
        <p className="text-sm font-medium text-muted-foreground">
          {myReview ? 'Modifier votre avis' : 'Publier un avis'}
        </p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Note</p>
          <StarPicker value={rating} onChange={setRating} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Commentaire</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Partagez votre expérience avec la communauté…"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>
        {mutation.isError && (
          <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
        )}
        {mutation.isSuccess && (
          <p className="text-xs text-green-600">Avis enregistré.</p>
        )}
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? 'Enregistrement…' : myReview ? 'Modifier' : 'Publier'}
        </Button>
      </div>

      {/* Reviews list */}
      {isLoading && (
        <div className="space-y-2">
          <div className="h-12 bg-muted animate-pulse rounded-md" />
          <div className="h-12 bg-muted animate-pulse rounded-md" />
        </div>
      )}

      {!isLoading && reviews.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Aucun avis pour le moment.</p>
      )}

      {!isLoading && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {review.cabinet.name}
                    {review.cabinet.id === cabinetId && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(vous)</span>
                    )}
                  </span>
                  <StarDisplay value={review.rating} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
