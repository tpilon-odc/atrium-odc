'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { contactApi, type ContactType } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const schema = z.object({
  lastName: z.string().min(1, 'Le nom est requis'),
  firstName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  type: z.enum(['prospect', 'client', 'ancien_client']),
})

type FormData = z.infer<typeof schema>

const TYPES: Array<{ value: ContactType; label: string }> = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'client', label: 'Client' },
  { value: 'ancien_client', label: 'Ancien client' },
]

export default function ModifierContactPage({ params }: { params: { id: string } }) {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = params

  const { data, isLoading } = useQuery({
    queryKey: ['contact', id, token],
    queryFn: () => contactApi.get(id, token!),
    enabled: !!token,
  })

  const contact = data?.data.contact

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: contact ? {
      lastName: contact.lastName,
      firstName: contact.firstName ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      type: contact.type,
    } : undefined,
  })

  const selectedType = watch('type')

  const mutation = useMutation({
    mutationFn: (data: FormData) => contactApi.update(id, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id, token] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      router.push(`/crm/${id}`)
    },
  })

  if (isLoading) return <div className="h-64 bg-muted animate-pulse rounded-lg max-w-xl" />

  return (
    <div className="space-y-6 max-w-xl">
      <Link href={`/crm/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Retour au contact
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Modifier le contact</h2>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <div className="flex gap-2">
            {TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('type', value)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                  selectedType === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Prénom</Label>
            <Input {...register('firstName')} />
          </div>
          <div className="space-y-1.5">
            <Label>Nom <span className="text-destructive">*</span></Label>
            <Input {...register('lastName')} />
            {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Téléphone</Label>
          <Input {...register('phone')} />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">Erreur : {(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Link href={`/crm/${id}`}><Button type="button" variant="outline">Annuler</Button></Link>
        </div>
      </form>
    </div>
  )
}
