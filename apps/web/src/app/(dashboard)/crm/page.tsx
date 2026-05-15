'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Search, ChevronRight, User, Mail, Phone, Share2, AlertTriangle, UserX, X, Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { contactApi, cabinetApi, platformUserApi, type Contact, type ContactType, type PlatformUser } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShareModal } from '@/components/ui/ShareModal'
import { ImportContactsModal } from '@/components/crm/ImportContactsModal'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

async function shareAllContacts(recipientIds: string[], token: string): Promise<{ created: number; skipped: number; total: number }> {
  const res = await fetch(`${API_URL}/api/v1/shares/batch-all-contacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientIds }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Erreur API')
  return json.data
}

const ROLE_LABELS: Record<string, string> = {
  chamber: 'Chambre',
  regulator: 'Régulateur',
  platform_admin: 'Admin',
  cabinet_user: 'Cabinet',
}

function ShareAllModal({ onClose, token }: { onClose: () => void; token: string }) {
  const [search, setSearch] = useState('')
  const [recipients, setRecipients] = useState<PlatformUser[]>([])
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ['user-search-all', search, token],
    queryFn: () => platformUserApi.search(search, token),
    enabled: search.length >= 2,
  })
  const searchResults = (searchData?.data.users ?? []).filter(
    (u) => ['chamber', 'regulator', 'platform_admin', 'cabinet_user'].includes(u.globalRole) && !recipients.find((r) => r.id === u.id)
  )

  const mutation = useMutation({
    mutationFn: () => shareAllContacts(recipients.map((r) => r.id), token),
    onSuccess: (res) => {
      setSuccessMsg(`${res.created} partage(s) créé(s) sur ${res.total} dossier(s)${res.skipped ? ` · ${res.skipped} déjà existant(s)` : ''}`)
      setRecipients([])
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold">Partager tous les dossiers clients</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Tous les contacts du cabinet seront partagés avec les destinataires sélectionnés</p>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Destinataires sélectionnés */}
          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipients.map((r) => {
                const fullName = [r.firstName, r.lastName].filter(Boolean).join(' ')
                return (
                  <span key={r.id} className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {fullName || r.email}
                    {fullName && <span className="text-[10px] opacity-60">{r.email}</span>}
                    <span className="text-[10px] opacity-60">· {ROLE_LABELS[r.globalRole] ?? r.globalRole}</span>
                    <button onClick={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* Recherche destinataire */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Destinataires</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par email ou nom…"
                className="pl-8 text-sm"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            {searchResults.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden mt-1">
                {searchResults.map((u) => {
                  const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ')
                  return (
                    <button
                      key={u.id}
                      onClick={() => { setRecipients((prev) => [...prev, u]); setSearch('') }}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-left gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        {fullName
                          ? <p className="text-sm font-medium truncate">{fullName}</p>
                          : <p className="text-sm font-medium truncate">{u.email}</p>
                        }
                        {fullName && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                      </div>
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">
                        {ROLE_LABELS[u.globalRole] ?? u.globalRole}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {search.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5 px-1">Aucun utilisateur trouvé.</p>
            )}
          </div>

          {successMsg && (
            <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{successMsg}</p>
          )}
          {mutation.isError && (
            <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={recipients.length === 0 || mutation.isPending}>
            {mutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Partage…</>
              : <><Share2 className="h-3.5 w-3.5 mr-1.5" />Partager tous</>
            }
          </Button>
        </div>
      </div>
    </div>
  )
}

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

function ContactCard({ contact, onShare }: { contact: Contact; onShare: () => void }) {
  const initials = [contact.firstName?.[0], contact.lastName[0]].filter(Boolean).join('').toUpperCase()
  return (
    <div className="relative group/card">
      <Link
        href={`/crm/${contact.id}`}
        className="flex items-center gap-4 bg-card border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors group"
      >
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
          {initials || <User className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">
              {contact.firstName} {contact.lastName}
            </span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', TYPE_COLORS[contact.type])}>
              {TYPE_LABELS[contact.type]}
            </span>
            {contact.profileStatus?.isDueForReview && (
              <span className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 shrink-0">
                <AlertTriangle className="h-3 w-3" />
                Profil à réviser
              </span>
            )}
            {contact.profileStatus && !contact.profileStatus.hasProfile && (
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
                <UserX className="h-3 w-3" />
                Profil non défini
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {contact.email && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />{contact.email}
              </span>
            )}
            {contact.phone && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />{contact.phone}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); onShare() }}
        title="Partager ce contact"
        className="absolute top-1/2 -translate-y-1/2 right-10 opacity-0 group-hover/card:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

const TYPES: Array<{ value: ContactType | ''; label: string }> = [
  { value: '', label: 'Tous' },
  { value: 'prospect', label: 'Prospects' },
  { value: 'client', label: 'Clients' },
  { value: 'ancien_client', label: 'Anciens clients' },
]

export default function CRMPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ContactType | ''>('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [allItems, setAllItems] = useState<Contact[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [shareContact, setShareContact] = useState<Contact | null>(null)
  const [shareAllOpen, setShareAllOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const { data: importToolsData } = useQuery({
    queryKey: ['import-tools'],
    queryFn: () => cabinetApi.getImportTools(token!),
    enabled: !!token,
  })
  const importTools = importToolsData?.data?.tools ?? []

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['contacts', token, search, typeFilter, cursor],
    queryFn: () => contactApi.list(token!, {
      search: search || undefined,
      type: typeFilter || undefined,
      cursor: cursor ?? undefined,
      limit: 20,
    }),
    enabled: !!token,
  })

  useEffect(() => {
    if (!data) return
    const incoming = data.data.contacts
    if (!cursor) {
      setAllItems(incoming)
    } else {
      setAllItems((prev) => {
        const ids = new Set(prev.map((c) => c.id))
        return [...prev, ...incoming.filter((c) => !ids.has(c.id))]
      })
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setCursor(null)
    setAllItems([])
    setSearch(searchInput)
  }

  const handleTypeChange = (t: ContactType | '') => {
    setCursor(null)
    setAllItems([])
    setTypeFilter(t)
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">CRM</h2>
          <p className="text-muted-foreground mt-1">Gérez vos contacts et interactions.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {allItems.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              Partager
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShareAllOpen(true)}>
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            Partager tous
          </Button>
          {importTools.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Importer
            </Button>
          )}
          <Link href="/crm/nouveau">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Ajouter
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher par nom, email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button variant="outline" onClick={handleSearch}>Rechercher</Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleTypeChange(value)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                typeFilter === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="font-medium">Aucun contact trouvé</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || typeFilter ? 'Aucun résultat pour ces filtres.' : 'Ajoutez votre premier contact.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {allItems.map((c) => (
            <ContactCard key={c.id} contact={c} onShare={() => setShareContact(c)} />
          ))}
          {data?.data.hasMore && (
            <div className="pt-2 text-center">
              <Button variant="outline" size="sm" onClick={() => setCursor(data.data.nextCursor)} disabled={isFetching}>
                {isFetching ? 'Chargement…' : 'Charger plus'}
              </Button>
            </div>
          )}
        </div>
      )}
      {shareAllOpen && token && (
        <ShareAllModal onClose={() => setShareAllOpen(false)} token={token} />
      )}
      {importOpen && token && (
        <ImportContactsModal
          tools={importTools}
          token={token}
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false)
            setCursor(null)
            setAllItems([])
            refetch()
          }}
        />
      )}
      {(shareOpen || shareContact) && (
        <ShareModal
          title="Partager des contacts"
          description="Sélectionnez les contacts et les destinataires"
          entityType="contact"
          entities={shareContact
            ? [{
                id: shareContact.id,
                label: [shareContact.firstName, shareContact.lastName].filter(Boolean).join(' '),
                sublabel: shareContact.email ?? undefined,
                badge: { label: TYPE_LABELS[shareContact.type], variant: shareContact.type === 'client' ? 'ok' : 'neutral' },
              }]
            : allItems.map((c) => ({
                id: c.id,
                label: [c.firstName, c.lastName].filter(Boolean).join(' '),
                sublabel: c.email ?? undefined,
                badge: { label: TYPE_LABELS[c.type], variant: c.type === 'client' ? 'ok' : 'neutral' },
              }))
          }
          recipientRoles={['chamber', 'regulator', 'platform_admin', 'cabinet_user']}
          onClose={() => { setShareOpen(false); setShareContact(null) }}
        />
      )}
    </div>
  )
}
