'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Mail, Phone, Pencil, Trash2, Plus, Phone as PhoneIcon, Mail as MailIcon, Calendar, StickyNote, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { contactApi, type ContactType, type InteractionType, type Interaction } from '@/lib/api'
import { EntityDocuments } from '@/components/entity-documents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const TYPE_LABELS: Record<ContactType, string> = {
  prospect: 'Prospect',
  client: 'Client',
  ancien_client: 'Ancien client',
}

const TYPE_COLORS: Record<ContactType, string> = {
  prospect: 'bg-blue-100 text-blue-700',
  client: 'bg-green-100 text-green-700',
  ancien_client: 'bg-muted text-muted-foreground',
}

const INTERACTION_ICONS: Record<InteractionType, React.ElementType> = {
  email: MailIcon,
  appel: PhoneIcon,
  rdv: Calendar,
  note: StickyNote,
}

const INTERACTION_LABELS: Record<InteractionType, string> = {
  email: 'Email',
  appel: 'Appel',
  rdv: 'RDV',
  note: 'Note',
}

function InteractionItem({ interaction, contactId, onDelete }: {
  interaction: Interaction
  contactId: string
  onDelete: (id: string) => void
}) {
  const Icon = INTERACTION_ICONS[interaction.type]
  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm font-medium">{INTERACTION_LABELS[interaction.type]}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {new Date(interaction.occurredAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-xs text-muted-foreground ml-2">par {interaction.user.email}</span>
          </div>
          <button
            onClick={() => onDelete(interaction.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {interaction.note && (
          <p className="text-sm text-muted-foreground mt-1">{interaction.note}</p>
        )}
      </div>
    </div>
  )
}

function AddInteractionForm({ contactId }: { contactId: string }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [type, setType] = useState<InteractionType>('note')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: () => contactApi.addInteraction(contactId, {
      type,
      note: note || undefined,
      occurredAt: new Date(date).toISOString(),
    }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId, token] })
      setNote('')
      setOpen(false)
    },
  })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        <Plus className="h-4 w-4" />
        Ajouter une interaction
      </button>
    )
  }

  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(['email', 'appel', 'rdv', 'note'] as InteractionType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
              type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {INTERACTION_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Note (optionnelle)</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Résumé de l'interaction…" className="text-sm" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
    </div>
  )
}

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { id } = params

  const { data, isLoading } = useQuery({
    queryKey: ['contact', id, token],
    queryFn: () => contactApi.get(id, token!),
    enabled: !!token,
  })

  const contact = data?.data.contact
  const interactions = contact?.interactions ?? []

  const deleteMutation = useMutation({
    mutationFn: () => contactApi.delete(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      router.push('/crm')
    },
  })

  const deleteInteraction = useMutation({
    mutationFn: (interactionId: string) => contactApi.deleteInteraction(id, interactionId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact', id, token] }),
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Retour aux contacts
        </Link>
        {contact && (
          <div className="flex items-center gap-2">
            <Link href={`/crm/${id}/modifier`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Modifier
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => confirm('Supprimer ce contact ?') && deleteMutation.mutate()}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {isLoading && <div className="h-40 bg-muted animate-pulse rounded-lg" />}
      {!isLoading && !contact && <p className="text-muted-foreground">Contact introuvable.</p>}

      {contact && (
        <>
          {/* Fiche contact */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl shrink-0">
                {[contact.firstName?.[0], contact.lastName[0]].filter(Boolean).join('').toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {contact.firstName} {contact.lastName}
                </h2>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TYPE_COLORS[contact.type])}>
                  {TYPE_LABELS[contact.type]}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Mail className="h-4 w-4" />
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Phone className="h-4 w-4" />
                  {contact.phone}
                </a>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Ajouté le {new Date(contact.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>

          {/* Documents */}
          <div className="bg-card border border-border rounded-lg p-5">
            <EntityDocuments entityType="contact" entityId={id} />
          </div>

          {/* Timeline interactions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Interactions ({interactions.length})
              </h3>
            </div>

            <AddInteractionForm contactId={id} />

            {interactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune interaction enregistrée.</p>
            ) : (
              <div className="mt-4">
                {interactions.map((interaction) => (
                  <InteractionItem
                    key={interaction.id}
                    interaction={interaction}
                    contactId={id}
                    onDelete={(iid) => deleteInteraction.mutate(iid)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
