'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { supplierApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function ModifierFournisseurPage({ params }: { params: { id: string } }) {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = params

  const { data, isLoading } = useQuery({
    queryKey: ['supplier', id, token],
    queryFn: () => supplierApi.get(id, token!),
    enabled: !!token,
  })

  const supplier = data?.data.supplier

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: supplier ? {
      name: supplier.name,
      description: supplier.description ?? '',
      category: supplier.category ?? '',
      website: supplier.website ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
    } : undefined,
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => supplierApi.update(id, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', id, token] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      router.push(`/fournisseurs/${id}`)
    },
  })

  if (isLoading) {
    return <div className="h-64 bg-muted animate-pulse rounded-lg max-w-xl" />
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href={`/fournisseurs/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour au fournisseur
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Modifier le fournisseur</h2>
        <p className="text-muted-foreground mt-1">Les modifications sont visibles par tous les cabinets et tracées.</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Nom <span className="text-destructive">*</span></Label>
          <Input {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Catégorie</Label>
          <Input {...register('category')} />
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input {...register('description')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Site web</Label>
            <Input {...register('website')} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Téléphone</Label>
          <Input {...register('phone')} />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            Erreur : {(mutation.error as Error).message}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Link href={`/fournisseurs/${id}`}>
            <Button type="button" variant="outline">Annuler</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
