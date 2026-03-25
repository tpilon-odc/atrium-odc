'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { contactApi, type ContactType, type MaritalStatus } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const schema = z.object({
  lastName: z.string().min(1, 'Le nom est requis'),
  firstName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  email2: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  type: z.enum(['prospect', 'client', 'ancien_client']),
  birthDate: z.string().optional(),
  profession: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  maritalStatus: z.enum(['celibataire', 'marie', 'pacse', 'divorce', 'veuf']).optional(),
  dependents: z.coerce.number().int().min(0).optional(),
})

type FormData = z.infer<typeof schema>

const TYPES: Array<{ value: ContactType; label: string }> = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'client', label: 'Client' },
  { value: 'ancien_client', label: 'Ancien client' },
]

const MARITAL_STATUSES: Array<{ value: MaritalStatus; label: string }> = [
  { value: 'celibataire', label: 'Célibataire' },
  { value: 'marie', label: 'Marié(e)' },
  { value: 'pacse', label: 'Pacsé(e)' },
  { value: 'divorce', label: 'Divorcé(e)' },
  { value: 'veuf', label: 'Veuf/Veuve' },
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
      email2: contact.email2 ?? '',
      phone: contact.phone ?? '',
      phone2: contact.phone2 ?? '',
      type: contact.type,
      birthDate: contact.birthDate ? contact.birthDate.slice(0, 10) : '',
      profession: contact.profession ?? '',
      address: contact.address ?? '',
      city: contact.city ?? '',
      postalCode: contact.postalCode ?? '',
      country: contact.country ?? 'France',
      maritalStatus: contact.maritalStatus ?? undefined,
      dependents: contact.dependents ?? undefined,
    } : undefined,
  })

  const selectedType = watch('type')
  const selectedMaritalStatus = watch('maritalStatus')

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

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
        {/* Identité */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identité</p>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex gap-2 flex-wrap">
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
            <Label>Profession</Label>
            <Input {...register('profession')} placeholder="Ex : Médecin, Chef d'entreprise…" />
          </div>

          <div className="space-y-1.5">
            <Label>Date de naissance</Label>
            <Input type="date" {...register('birthDate')} />
          </div>
        </div>

        {/* Coordonnées */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coordonnées</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email principal</Label>
              <Input {...register('email')} placeholder="email@exemple.fr" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email secondaire</Label>
              <Input {...register('email2')} placeholder="email2@exemple.fr" />
              {errors.email2 && <p className="text-xs text-destructive">{errors.email2.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Téléphone principal</Label>
              <Input {...register('phone')} placeholder="06 xx xx xx xx" />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone secondaire</Label>
              <Input {...register('phone2')} placeholder="01 xx xx xx xx" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Adresse</Label>
            <Input {...register('address')} placeholder="12 rue de la Paix" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Code postal</Label>
              <Input {...register('postalCode')} placeholder="75001" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Ville</Label>
              <Input {...register('city')} placeholder="Paris" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Pays</Label>
            <Input {...register('country')} />
          </div>
        </div>

        {/* Situation personnelle */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Situation personnelle</p>

          <div className="space-y-1.5">
            <Label>Situation familiale</Label>
            <div className="flex gap-2 flex-wrap">
              {MARITAL_STATUSES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('maritalStatus', selectedMaritalStatus === value ? undefined : value)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                    selectedMaritalStatus === value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nombre d'enfants</Label>
            <Input type="number" min={0} {...register('dependents')} className="w-24" />
          </div>
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">Erreur : {(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Link href={`/crm/${id}`}><Button type="button" variant="outline">Annuler</Button></Link>
        </div>
      </form>
    </div>
  )
}
