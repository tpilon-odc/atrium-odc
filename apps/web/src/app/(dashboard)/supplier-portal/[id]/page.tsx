'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, BadgeCheck, Save, Star, MessageSquare } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { supplierPortalApi, type SupplierReview } from '@/lib/api'
import { EntityDocuments } from '@/components/entity-documents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SupplierPortalDetailPage({ params }: { params: { id: string } }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const { id } = params

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-portal', id, token],
    queryFn: () => supplierPortalApi.getSupplier(id, token!),
    enabled: !!token,
  })

  const { data: reviewsData } = useQuery({
    queryKey: ['supplier-portal-reviews', id, token],
    queryFn: () => supplierPortalApi.listReviews(id, token!),
    enabled: !!token,
  })
  const reviews: SupplierReview[] = reviewsData?.data.reviews ?? []
  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  const supplier = data?.data.supplier

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (supplier) {
      setName(supplier.name)
      setDescription(supplier.description ?? '')
      setCategory(supplier.category ?? '')
      setWebsite(supplier.website ?? '')
      setEmail(supplier.email ?? '')
      setPhone(supplier.phone ?? '')
      setDirty(false)
    }
  }, [supplier])

  const mutation = useMutation({
    mutationFn: () => supplierPortalApi.updateSupplier(id, {
      name,
      description: description || null,
      category: category || null,
      website: website || null,
      email: email || null,
      phone: phone || null,
    }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-portal', id, token] })
      queryClient.invalidateQueries({ queryKey: ['supplier-portal-me', token] })
      setDirty(false)
    },
  })

  const field = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value)
    setDirty(true)
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <Link href="/supplier-portal" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Mes fiches
      </Link>

      {isLoading && (
        <div className="space-y-4">
          <div className="h-10 bg-muted animate-pulse rounded-lg w-48" />
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      )}

      {!isLoading && !supplier && (
        <p className="text-muted-foreground">Fiche introuvable ou accès refusé.</p>
      )}

      {supplier && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
              {supplier.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{supplier.name}</h2>
                {supplier.isVerified && <BadgeCheck className="h-5 w-5 text-blue-500" />}
              </div>
              <p className="text-xs text-muted-foreground">
                Créée le {new Date(supplier.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-medium text-sm">Informations de la fiche</h3>

            <div className="space-y-1.5">
              <Label className="text-xs">Nom de la société <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={field(setName)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Catégorie</Label>
              <Input value={category} onChange={field(setCategory)} placeholder="Ex : Assurance, Immobilier, SCPI…" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <textarea
                value={description}
                onChange={field(setDescription)}
                placeholder="Décrivez votre société, vos produits et services…"
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Site web</Label>
                <Input value={website} onChange={field(setWebsite)} placeholder="https://…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email de contact</Label>
                <Input type="email" value={email} onChange={field(setEmail)} placeholder="contact@société.fr" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Téléphone</Label>
              <Input value={phone} onChange={field(setPhone)} placeholder="+33 1 23 45 67 89" />
            </div>

            {mutation.isError && (
              <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
            )}
            {mutation.isSuccess && !dirty && (
              <p className="text-xs text-green-600">Fiche enregistrée.</p>
            )}

            <Button
              onClick={() => mutation.mutate()}
              disabled={!name.trim() || !dirty || mutation.isPending}
              size="sm"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </Button>
          </div>

          {/* Documents */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-medium text-sm mb-4">Documents</h3>
            <EntityDocuments entityType="supplier" entityId={id} supplierId={id} />
          </div>

          {/* Avis cabinets */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Avis cabinets ({reviews.length})
              </h3>
              {avgRating !== null && (
                <div className="flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{avgRating.toFixed(1)}</span>
                  <span className="text-muted-foreground text-xs">/ 5</span>
                </div>
              )}
            </div>

            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun avis pour le moment.</p>
            ) : (
              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="border border-border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{r.cabinet.name}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3.5 w-3.5 ${s <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                          />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
