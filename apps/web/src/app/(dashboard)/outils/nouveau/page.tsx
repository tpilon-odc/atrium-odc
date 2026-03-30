'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { toolApi, toolCategoryApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  url: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NouvelOutilPage() {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: categoriesData } = useQuery({
    queryKey: ['tool-categories', token],
    queryFn: () => toolCategoryApi.list(token!),
    enabled: !!token,
  })
  const categories = categoriesData?.data.categories ?? []

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => toolApi.create(data, token!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      router.push(`/outils/${res.data.tool.id}`)
    },
  })

  return (
    <div className="space-y-6 max-w-xl">
      <Link href="/outils" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Retour aux outils
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Ajouter un outil</h2>
        <p className="text-muted-foreground mt-1">Logiciel, plateforme ou service utilisé par les CGP.</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Nom <span className="text-destructive">*</span></Label>
          <Input {...register('name')} placeholder="Nom de l'outil" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Catégorie</Label>
          {categories.length > 0 ? (
            <select
              {...register('category')}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Choisir une catégorie —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.label}>{cat.label}</option>
              ))}
            </select>
          ) : (
            <Input {...register('category')} placeholder="ex: CRM, Reporting, Agrégation…" />
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input {...register('description')} placeholder="Courte description" />
        </div>
        <div className="space-y-1.5">
          <Label>URL</Label>
          <Input {...register('url')} placeholder="https://…" />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">Erreur : {(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Création…' : "Créer l'outil"}
          </Button>
          <Link href="/outils"><Button type="button" variant="outline">Annuler</Button></Link>
        </div>
      </form>
    </div>
  )
}
