'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Mail, Phone, Pencil, Trash2, Plus, Phone as PhoneIcon, Mail as MailIcon, Calendar, StickyNote, MessageSquare, CalendarDays, ShieldAlert, CheckSquare, MapPin, Briefcase, Baby, Heart, ShieldCheck, BarChart3, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { contactApi, eventApi, type ContactType, type MaritalStatus, type InteractionType, type Interaction, type CalendarEvent, type EventType } from '@/lib/api'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ContactProfileTab } from '@/components/crm/ContactProfileTab'
import { ContactAdequacyTab } from '@/components/crm/ContactAdequacyTab'
import { ContactPatrimoineTab } from '@/components/crm/ContactPatrimoineTab'

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  RDV:        'text-blue-500',
  CALL:       'text-green-500',
  TASK:       'text-orange-500',
  COMPLIANCE: 'text-red-500',
}
const EVENT_TYPE_ICONS: Record<EventType, React.ElementType> = {
  RDV:        CalendarDays,
  CALL:       PhoneIcon,
  TASK:       CheckSquare,
  COMPLIANCE: ShieldAlert,
}
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  RDV: 'RDV', CALL: 'Appel', TASK: 'Tâche', COMPLIANCE: 'Conformité',
}
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

const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  celibataire: 'Célibataire',
  marie: 'Marié(e)',
  pacse: 'Pacsé(e)',
  divorce: 'Divorcé(e)',
  veuf: 'Veuf/Veuve',
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
  const [activeTab, setActiveTab] = useState<'interactions' | 'agenda' | 'profil_mifid' | 'adequation' | 'patrimoine'>('interactions')
  const [showNewEvent, setShowNewEvent] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['contact', id, token],
    queryFn: () => contactApi.get(id, token!),
    enabled: !!token,
  })

  const { data: eventsData } = useQuery({
    queryKey: ['events-contact', id, token],
    queryFn: () => eventApi.list(token!, {}),
    enabled: !!token && activeTab === 'agenda',
    select: (res) => res.data.events.filter((e) => e.contactId === id),
    staleTime: 30_000,
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
    <div className="space-y-6 max-w-6xl">
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
          <div className="bg-card border border-border rounded-lg p-6 space-y-5">
            {/* En-tête */}
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl shrink-0">
                {[contact.firstName?.[0], contact.lastName[0]].filter(Boolean).join('').toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {contact.firstName} {contact.lastName}
                </h2>
                {contact.profession && (
                  <p className="text-sm text-muted-foreground">{contact.profession}</p>
                )}
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block', TYPE_COLORS[contact.type])}>
                  {TYPE_LABELS[contact.type]}
                </span>
              </div>
            </div>

            {/* Coordonnées */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coordonnées</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </a>
                )}
                {contact.email2 && (
                  <a href={`mailto:${contact.email2}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{contact.email2}</span>
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {contact.phone}
                  </a>
                )}
                {contact.phone2 && (
                  <a href={`tel:${contact.phone2}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {contact.phone2}
                  </a>
                )}
                {(contact.address || contact.city) && (
                  <span className="flex items-start gap-1.5 text-muted-foreground sm:col-span-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      {[contact.address, contact.postalCode && contact.city ? `${contact.postalCode} ${contact.city}` : contact.city, contact.country !== 'France' ? contact.country : null].filter(Boolean).join(', ')}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Situation personnelle */}
            {(contact.birthDate || contact.maritalStatus !== null || contact.dependents !== null) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Situation personnelle</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  {contact.birthDate && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      {new Date(contact.birthDate).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                  {contact.maritalStatus && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Heart className="h-3.5 w-3.5 shrink-0" />
                      {MARITAL_STATUS_LABELS[contact.maritalStatus]}
                    </div>
                  )}
                  {contact.dependents !== null && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Baby className="h-3.5 w-3.5 shrink-0" />
                      {contact.dependents} enfant{contact.dependents !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}

            {contact.profession && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profession</p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  {contact.profession}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              Ajouté le {new Date(contact.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>

          {/* Documents */}
          <div className="bg-card border border-border rounded-lg p-5">
            <EntityDocuments entityType="contact" entityId={id} />
          </div>

          {/* Onglets */}
          <div>
            <div className="flex border-b border-border mb-4 overflow-x-auto">
              {([
                { key: 'interactions', label: `Interactions (${interactions.length})`, icon: MessageSquare },
                { key: 'agenda', label: 'Agenda', icon: CalendarDays },
                { key: 'profil_mifid', label: 'Profil MiFID', icon: ShieldCheck },
                { key: 'adequation', label: 'Adéquation produits', icon: BarChart3 },
                { key: 'patrimoine', label: 'Situation patrimoniale', icon: Landmark },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                    activeTab === key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {activeTab === 'interactions' && (
              <div className="space-y-4">
                <AddInteractionForm contactId={id} />
                {interactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune interaction enregistrée.</p>
                ) : (
                  <div className="mt-2">
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
            )}

            {activeTab === 'agenda' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/agenda?contactId=${id}`}
                    className="inline-flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Créer un événement
                  </Link>
                  <Link
                    href="/agenda"
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Ouvrir l'agenda complet
                  </Link>
                </div>

                {!eventsData?.length ? (
                  <p className="text-sm text-muted-foreground">Aucun événement lié à ce contact.</p>
                ) : (
                  <ul className="space-y-2">
                    {eventsData.map((ev: CalendarEvent) => {
                      const Icon = EVENT_TYPE_ICONS[ev.type]
                      return (
                        <li key={ev.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors">
                          <Icon className={cn('h-4 w-4 shrink-0', EVENT_TYPE_COLORS[ev.type])} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ev.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {EVENT_TYPE_LABELS[ev.type]} · {ev.allDay
                                ? format(new Date(ev.startAt), 'd MMM yyyy', { locale: fr })
                                : format(new Date(ev.startAt), 'd MMM yyyy HH:mm', { locale: fr })}
                            </p>
                          </div>
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            ev.status === 'DONE' ? 'bg-green-100 text-green-700' :
                            ev.status === 'CANCELLED' ? 'bg-muted text-muted-foreground' :
                            'bg-blue-100 text-blue-700'
                          )}>
                            {ev.status === 'DONE' ? 'Réalisé' : ev.status === 'CANCELLED' ? 'Annulé' : 'Planifié'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'profil_mifid' && token && (
              <ContactProfileTab contactId={id} token={token} />
            )}

            {activeTab === 'adequation' && token && (
              <ContactAdequacyTab contactId={id} token={token} />
            )}

            {activeTab === 'patrimoine' && token && (
              <ContactPatrimoineTab contactId={id} token={token} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
