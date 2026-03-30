'use client'

import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { productApi, productSubcategoryApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MAIN_CATEGORIES = [
  { value: 'assurance', label: 'Assurance' },
  { value: 'cif', label: 'Conseil en investissement financier (CIF)' },
] as const

const schema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  website: z.string().optional(),
  mainCategory: z.enum(['assurance', 'cif']).nullable().optional(),
})

type FormData = z.infer<typeof schema>

export default function ModifierProduitPage({ params }: { params: { id: string } }) {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = params

  const { data, isLoading } = useQuery({
    queryKey: ['product', id, token],
    queryFn: () => productApi.get(id, token!),
    enabled: !!token,
  })

  const product = data?.data.product

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: product ? {
      name: product.name,
      description: product.description ?? '',
      category: product.category ?? '',
      website: product.website ?? '',
      mainCategory: product.mainCategory ?? null,
    } : undefined,
  })

  const selectedMainCategory = useWatch({ control, name: 'mainCategory' })

  const { data: subcatData } = useQuery({
    queryKey: ['product-subcategories', selectedMainCategory],
    queryFn: () => productSubcategoryApi.list(token!, selectedMainCategory ?? undefined),
    enabled: !!token && !!selectedMainCategory,
  })
  const subcategories = subcatData?.data.subcategories ?? []

  const mutation = useMutation({
    mutationFn: (data: FormData) => productApi.update(id, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id, token] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      router.push(`/produits/${id}`)
    },
  })

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-lg max-w-xl" />

  return (
    <div className="space-y-6 max-w-xl">
      <Link href={`/produits/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Retour au produit
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Modifier le produit</h2>
        <p className="text-muted-foreground mt-1">Les modifications sont visibles par tous et tracées.</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Nom <span className="text-destructive">*</span></Label>
          <Input {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Catégorie principale</Label>
          <div className="flex gap-3">
            {MAIN_CATEGORIES.map((mc) => (
              <label key={mc.value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value={mc.value} {...register('mainCategory')} className="accent-primary" />
                <span className="text-sm">{mc.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Sous-catégorie</Label>
          {subcategories.length > 0 ? (
            <select {...register('category')} className="w-full h-9 text-sm rounded-md border border-input bg-background px-3">
              <option value="">— Sélectionner —</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.label}>{s.label}</option>
              ))}
            </select>
          ) : (
            <Input {...register('category')} placeholder={selectedMainCategory ? 'Saisir manuellement…' : 'Choisir d\'abord une catégorie principale'} disabled={!selectedMainCategory} />
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input {...register('description')} />
        </div>
        <div className="space-y-1.5">
          <Label>Site web</Label>
          <Input {...register('website')} />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">Erreur : {(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Link href={`/produits/${id}`}><Button type="button" variant="outline">Annuler</Button></Link>
        </div>
      </form>
    </div>
  )
}
