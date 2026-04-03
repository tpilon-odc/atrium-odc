'use client'

import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { contactApi, type ContactType, type MaritalStatus, type Contact } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'
import { contactSchema as schema, ContactFormData as FormData } from '@/lib/schemas'

// ── Détection doublons ────────────────────────────────────────────────────────

function useDuplicateDetection(email: string, firstName: string, lastName: string, token: string | null) {
  const emailQuery = useQuery({
    queryKey: ['contacts-dup-email', token, email],
    queryFn: () => contactApi.list(token!, { search: email, limit: 5 }),
    enabled: !!token && email.length >= 5 && email.includes('@'),
    staleTime: 2000,
  })

  const nameQuery = useQuery({
    queryKey: ['contacts-dup-name', token, lastName, firstName],
    queryFn: () => contactApi.list(token!, { search: `${firstName} ${lastName}`.trim(), limit: 5 }),
    enabled: !!token && lastName.length >= 3,
    staleTime: 2000,
  })

  const emailMatches: Contact[] = (emailQuery.data?.data.contacts ?? []).filter(
    (c) => c.email?.toLowerCase() === email.toLowerCase()
  )

  const nameMatches: Contact[] = (nameQuery.data?.data.contacts ?? []).filter((c) => {
    const full = `${c.firstName ?? ''} ${c.lastName}`.toLowerCase().trim()
    const input = `${firstName} ${lastName}`.toLowerCase().trim()
    return full === input && !emailMatches.find((e) => e.id === c.id)
  })

  return { emailMatches, nameMatches }
}

// ── Bandeau doublon ───────────────────────────────────────────────────────────

function DuplicateWarning({ matches, certain }: { matches: Contact[]; certain: boolean }) {
  if (matches.length === 0) return null
  return (
    <div className={cn(
      'flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm',
      certain
        ? 'bg-danger-subtle text-danger-subtle-foreground'
        : 'bg-warning-subtle text-warning-subtle-foreground'
    )}>
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="font-medium">
          {certain ? 'Doublon détecté' : 'Contact similaire existant'}
        </p>
        {matches.map((c) => (
          <p key={c.id} className="text-xs">
            <Link href={`/crm/${c.id}`} className="underline underline-offset-2 hover:opacity-80" target="_blank">
              {c.firstName} {c.lastName}
              {c.email ? ` — ${c.email}` : ''}
            </Link>
          </p>
        ))}
        {!certain && <p className="text-xs opacity-75 mt-1">Vous pouvez quand même créer ce contact s&apos;il est différent.</p>}
      </div>
    </div>
  )
}

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

export default function NouveauContactPage() {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'prospect', country: 'France' },
  })

  const selectedType = watch('type')
  const selectedMaritalStatus = watch('maritalStatus')
  const watchedEmail = watch('email') ?? ''
  const watchedFirstName = watch('firstName') ?? ''
  const watchedLastName = watch('lastName') ?? ''

  const { emailMatches, nameMatches } = useDuplicateDetection(watchedEmail, watchedFirstName, watchedLastName, token)

  const mutation = useMutation({
    mutationFn: (data: FormData) => contactApi.create(data, token!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      router.push(`/crm/${res.data.contact.id}`)
    },
  })

  return (
    <div className="space-y-6 max-w-7xl">
      <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Retour aux contacts
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Ajouter un contact</h2>
        <p className="text-muted-foreground mt-1">Contact privé, visible uniquement par votre cabinet.</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
        {/* Identité */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identité</p>

          <div className="space-y-1.5">
            <Label>Type <span className="text-destructive">*</span></Label>
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
              <Input {...register('firstName')} placeholder="Prénom" />
            </div>
            <div className="space-y-1.5">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input {...register('lastName')} placeholder="Nom" />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>

          <DuplicateWarning matches={nameMatches} certain={false} />

          <div className="space-y-1.5">
            <Label>Profession</Label>
            <Input {...register('profession')} placeholder="Ex : Médecin, Chef d'entreprise…" />
          </div>

          <div className="space-y-1.5">
            <Label>Date de naissance</Label>
            <Controller
              name="birthDate"
              control={control}
              render={({ field }) => (
                <DatePicker value={field.value ?? ''} onChange={field.onChange} />
              )}
            />
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

          <DuplicateWarning matches={emailMatches} certain={true} />

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
            <Label>Nombre d&apos;enfants</Label>
            <Input type="number" min={0} {...register('dependents')} className="w-24" />
          </div>
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">Erreur : {(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Création…' : 'Créer le contact'}
          </Button>
          <Link href="/crm"><Button type="button" variant="outline">Annuler</Button></Link>
        </div>
      </form>
    </div>
  )
}
