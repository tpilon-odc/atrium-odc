'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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

export default function NouveauFournisseurPage() {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => supplierApi.create(data, token!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      router.push(`/fournisseurs/${res.data.supplier.id}`)
    },
  })

  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href="/fournisseurs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux fournisseurs
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Ajouter un fournisseur</h2>
        <p className="text-muted-foreground mt-1">Visible par tous les cabinets de la plateforme.</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Nom <span className="text-destructive">*</span></Label>
          <Input {...register('name')} placeholder="Nom du fournisseur" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Catégorie</Label>
          <Input {...register('category')} placeholder="ex: Assurance-vie, SCPI, Prévoyance…" />
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input {...register('description')} placeholder="Courte description du fournisseur" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Site web</Label>
            <Input {...register('website')} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input {...register('email')} placeholder="contact@…" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Téléphone</Label>
          <Input {...register('phone')} placeholder="01 23 45 67 89" />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            Erreur : {(mutation.error as Error).message}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Création…' : 'Créer le fournisseur'}
          </Button>
          <Link href="/fournisseurs">
            <Button type="button" variant="outline">Annuler</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
