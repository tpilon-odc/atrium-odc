'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Heart, Baby, Briefcase, User } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { shareApi, contactApi, type Contact, type Interaction } from '@/lib/api'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  client: 'Client',
  lead: 'Lead',
}

const TYPE_COLORS: Record<string, string> = {
  prospect: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  client:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  lead:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: 'Célibataire',
  married: 'Marié(e)',
  divorced: 'Divorcé(e)',
  widowed: 'Veuf/Veuve',
  civil_union: 'PACS',
  separated: 'Séparé(e)',
}

type SharedContact = {
  shareId: string
  entityId: string
  cabinetName: string | null
  contact: (Contact & { interactions: Interaction[] }) | null
  loading: boolean
}

function ContactDetail({ contact }: { contact: Contact & { interactions: Interaction[] } }) {
  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl shrink-0">
          {[contact.firstName?.[0], contact.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
        </div>
        <div>
          <h3 className="text-xl font-semibold">{contact.firstName} {contact.lastName}</h3>
          {contact.profession && <p className="text-sm text-muted-foreground">{contact.profession}</p>}
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block', TYPE_COLORS[contact.type] ?? '')}>
            {TYPE_LABELS[contact.type] ?? contact.type}
          </span>
        </div>
      </div>

      {/* Coordonnées */}
      {(contact.email || contact.phone || contact.address) && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coordonnées</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{contact.email}</span>
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />{contact.phone}
              </a>
            )}
            {(contact.address || contact.city) && (
              <span className="flex items-start gap-1.5 text-muted-foreground sm:col-span-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{[(contact as any).address, (contact as any).postalCode && contact.city ? `${(contact as any).postalCode} ${contact.city}` : contact.city].filter(Boolean).join(', ')}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Situation personnelle */}
      {((contact as any).birthDate || (contact as any).maritalStatus || (contact as any).dependents != null) && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Situation personnelle</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {(contact as any).birthDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date((contact as any).birthDate).toLocaleDateString('fr-FR')}
              </span>
            )}
            {(contact as any).maritalStatus && (
              <span className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5" />
                {MARITAL_STATUS_LABELS[(contact as any).maritalStatus] ?? (contact as any).maritalStatus}
              </span>
            )}
            {(contact as any).dependents != null && (
              <span className="flex items-center gap-1.5">
                <Baby className="h-3.5 w-3.5" />
                {(contact as any).dependents} enfant{(contact as any).dependents !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {contact.profession && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profession</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" />{contact.profession}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        Ajouté le {new Date(contact.createdAt).toLocaleDateString('fr-FR')}
      </p>
    </div>
  )
}

function SharedContactCard({
  item,
  onClick,
}: {
  item: SharedContact
  onClick: () => void
}) {
  const name = item.contact
    ? [item.contact.firstName, item.contact.lastName].filter(Boolean).join(' ') || '—'
    : '…'

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-lg px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
    >
      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
        {item.contact
          ? [item.contact.firstName?.[0], item.contact.lastName?.[0]].filter(Boolean).join('').toUpperCase() || <User size={14} />
          : <User size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {item.cabinetName && (
          <p className="text-xs text-muted-foreground">Partagé par {item.cabinetName}</p>
        )}
        {item.contact && (
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block', TYPE_COLORS[item.contact.type] ?? '')}>
            {TYPE_LABELS[item.contact.type] ?? item.contact.type}
          </span>
        )}
      </div>
    </button>
  )
}

export default function ContactsPartagesPage() {
  const { token } = useAuthStore()
  const [selected, setSelected] = useState<string | null>(null) // entityId du contact sélectionné

  // Récupère tous les shares reçus
  const { data: sharesData, isLoading: loadingShares } = useQuery({
    queryKey: ['shares-received-contacts', token],
    queryFn: () => shareApi.listReceived(token!),
    enabled: !!token,
    select: (res) => res.data.shares.filter((s) => s.entityType === 'contact' && s.entityId),
  })

  const contactShares = sharesData ?? []

  // Récupère le contact sélectionné
  const { data: contactData, isLoading: loadingContact } = useQuery({
    queryKey: ['shared-contact', selected, token],
    queryFn: () => contactApi.getShared(selected!, token!),
    enabled: !!selected && !!token,
  })

  const selectedContact = contactData?.data.contact ?? null
  const selectedShare = contactShares.find((s) => s.entityId === selected)

  if (selected) {
    return (
      <div className="space-y-6 max-w-3xl">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          Retour aux contacts partagés
        </button>

        {loadingContact && <div className="h-40 bg-muted animate-pulse rounded-lg" />}

        {!loadingContact && selectedContact && (
          <div className="bg-card border border-border rounded-lg p-6">
            {selectedShare?.cabinet?.name && (
              <p className="text-xs text-muted-foreground mb-4 pb-3 border-b border-border">
                Partagé par <span className="font-medium">{selectedShare.cabinet.name}</span>
              </p>
            )}
            <ContactDetail contact={selectedContact} />
          </div>
        )}

        {!loadingContact && !selectedContact && (
          <p className="text-sm text-muted-foreground">Contact introuvable ou accès révoqué.</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold">Contacts partagés</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Dossiers clients partagés avec vous par les cabinets.
        </p>
      </div>

      {loadingShares ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : contactShares.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Aucun contact partagé</p>
          <p className="text-sm text-muted-foreground mt-1">
            Les cabinets qui partagent des dossiers avec vous apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {contactShares.map((share) => {
            const resolvedContact = (share as any).resolvedContact
            const item: SharedContact = {
              shareId: share.id,
              entityId: share.entityId!,
              cabinetName: share.cabinet?.name ?? null,
              contact: resolvedContact
                ? { ...resolvedContact, interactions: [], createdAt: '' }
                : null,
              loading: false,
            }
            return (
              <SharedContactCard
                key={share.id}
                item={item}
                onClick={() => setSelected(share.entityId!)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
