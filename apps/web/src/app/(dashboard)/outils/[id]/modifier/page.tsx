'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { toolApi } from '@/lib/api'
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

export default function ModifierOutilPage({ params }: { params: { id: string } }) {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = params

  const { data, isLoading } = useQuery({
    queryKey: ['tool', id, token],
    queryFn: () => toolApi.get(id, token!),
    enabled: !!token,
  })

  const tool = data?.data.tool

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: tool ? {
      name: tool.name,
      description: tool.description ?? '',
      category: tool.category ?? '',
      url: tool.url ?? '',
    } : undefined,
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => toolApi.update(id, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool', id, token] })
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      router.push(`/outils/${id}`)
    },
  })

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-lg max-w-xl" />

  return (
    <div className="space-y-6 max-w-xl">
      <Link href={`/outils/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Retour à l&apos;outil
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Modifier l&apos;outil</h2>
        <p className="text-muted-foreground mt-1">Les modifications sont visibles par tous et tracées.</p>
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
        <div className="space-y-1.5">
          <Label>URL</Label>
          <Input {...register('url')} />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">Erreur : {(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Link href={`/outils/${id}`}><Button type="button" variant="outline">Annuler</Button></Link>
        </div>
      </form>
    </div>
  )
}
