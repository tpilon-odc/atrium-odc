'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { contactApi, type ContactType, type Contact } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ── Détection doublons ────────────────────────────────────────────────────────

function useDuplicateDetection(email: string, firstName: string, lastName: string, token: string | null) {
  // Recherche par email si suffisamment rempli
  const emailQuery = useQuery({
    queryKey: ['contacts-dup-email', token, email],
    queryFn: () => contactApi.list(token!, { search: email, limit: 5 }),
    enabled: !!token && email.length >= 5 && email.includes('@'),
    staleTime: 2000,
  })

  // Recherche par nom si suffisamment rempli
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

export default function NouveauContactPage() {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'prospect' },
  })

  const selectedType = watch('type')
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
    <div className="space-y-6 max-w-xl">
      <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Retour aux contacts
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Ajouter un contact</h2>
        <p className="text-muted-foreground mt-1">Contact privé, visible uniquement par votre cabinet.</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-card border border-border rounded-lg p-6 space-y-4">
        {/* Type */}
        <div className="space-y-1.5">
          <Label>Type <span className="text-destructive">*</span></Label>
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
          <Label>Email</Label>
          <Input {...register('email')} placeholder="email@exemple.fr" />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <DuplicateWarning matches={emailMatches} certain={true} />

        <div className="space-y-1.5">
          <Label>Téléphone</Label>
          <Input {...register('phone')} placeholder="06 12 34 56 78" />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">Erreur : {(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Création…' : 'Créer le contact'}
          </Button>
          <Link href="/crm"><Button type="button" variant="outline">Annuler</Button></Link>
        </div>
      </form>
    </div>
  )
}
