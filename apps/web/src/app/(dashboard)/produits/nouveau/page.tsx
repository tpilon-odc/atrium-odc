'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { productApi, supplierApi, type Supplier } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  website: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NouveauProduitPage() {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [supplierSearch, setSupplierSearch] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-search', supplierSearch],
    queryFn: () => supplierApi.list(token!, { search: supplierSearch, limit: 10 }),
    enabled: !!token && supplierSearch.length >= 1,
  })
  const supplierResults: Supplier[] = suppliersData?.data.suppliers ?? []

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await productApi.create(data, token!)
      if (selectedSupplier) {
        await productApi.linkSupplier(res.data.product.id, selectedSupplier.id, token!)
      }
      return res
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      router.push(`/produits/${res.data.product.id}`)
    },
  })

  return (
    <div className="space-y-6 max-w-xl">
      <Link href="/produits" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Retour aux produits
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Ajouter un produit</h2>
        <p className="text-muted-foreground mt-1">Visible par tous les cabinets de la plateforme.</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Nom <span className="text-destructive">*</span></Label>
          <Input {...register('name')} placeholder="Nom du produit" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Catégorie</Label>
          <Input {...register('category')} placeholder="ex: Assurance-vie, SCPI, PER…" />
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input {...register('description')} placeholder="Courte description" />
        </div>

        <div className="space-y-1.5">
          <Label>Site web</Label>
          <Input {...register('website')} placeholder="https://…" />
        </div>

        {/* Fournisseur associé */}
        <div className="space-y-1.5">
          <Label>Fournisseur associé</Label>
          {selectedSupplier ? (
            <div className="flex items-center justify-between border border-border rounded-md px-3 py-2 bg-muted/40">
              <span className="text-sm">{selectedSupplier.name}</span>
              <button
                type="button"
                onClick={() => setSelectedSupplier(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                value={supplierSearch}
                onChange={(e) => { setSupplierSearch(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder="Rechercher un fournisseur…"
              />
              {showDropdown && supplierResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
                  {supplierResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={() => { setSelectedSupplier(s); setSupplierSearch(''); setShowDropdown(false) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <span className="font-medium">{s.name}</span>
                      {s.category && <span className="text-muted-foreground ml-2 text-xs">{s.category}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">Erreur : {(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Création…' : 'Créer le produit'}
          </Button>
          <Link href="/produits"><Button type="button" variant="outline">Annuler</Button></Link>
        </div>
      </form>
    </div>
  )
}
