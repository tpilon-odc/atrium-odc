'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Search, Share2, Loader2, Trash2 } from 'lucide-react'
import { platformUserApi, type PlatformUser } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const ROLE_LABELS: Record<string, string> = {
  chamber:        'Chambre',
  regulator:      'Régulateur',
  platform_admin: 'Admin',
  cabinet_user:   'Cabinet',
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type ShareableEntity = {
  id: string
  label: string
  sublabel?: string  // ex: phase, collaborateur, dossier…
  badge?: { label: string; variant: 'ok' | 'warn' | 'error' | 'neutral' }
}

export type ShareModalProps = {
  title: string
  description?: string
  entityType: string
  entities: ShareableEntity[]
  /** Rôles autorisés comme destinataires. Défaut : chamber + regulator */
  recipientRoles?: string[]
  onClose: () => void
}

type ExistingShare = {
  id: string
  entityId: string | null
  recipientUser: { id: string; email: string; globalRole: string }
  entityLabel?: string
}

const BADGE_CLASS: Record<string, string> = {
  ok:      'bg-green-100 text-green-700',
  warn:    'bg-amber-100 text-amber-700',
  error:   'bg-red-100 text-red-700',
  neutral: 'bg-muted text-muted-foreground',
}

// ── Appel API générique (réutilise la table shares) ────────────────────────────

async function fetchShares(entityType: string, token: string): Promise<ExistingShare[]> {
  const res = await fetch(`${API_URL}/api/v1/shares?entityType=${entityType}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  return json.data?.shares ?? []
}

async function createShares(
  entityType: string,
  entityIds: string[],
  recipientIds: string[],
  token: string
): Promise<{ created: number; skipped: number }> {
  const res = await fetch(`${API_URL}/api/v1/shares/batch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityType, entityIds, recipientIds }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Erreur API')
  return json.data
}

async function revokeShare(id: string, token: string): Promise<void> {
  await fetch(`${API_URL}/api/v1/shares/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ── Composant ──────────────────────────────────────────────────────────────────

export function ShareModal({
  title,
  description,
  entityType,
  entities,
  recipientRoles = ['chamber', 'regulator', 'platform_admin'],
  onClose,
}: ShareModalProps) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const overlayRef = useRef<HTMLDivElement>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [recipients, setRecipients] = useState<PlatformUser[]>([])
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Recherche destinataires
  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ['user-search', search, token],
    queryFn: () => platformUserApi.search(search, token!),
    enabled: !!token && search.length >= 2,
  })
  const searchResults = (searchData?.data.users ?? []).filter(
    (u) => recipientRoles.includes(u.globalRole) && !recipients.find((r) => r.id === u.id)
  )

  // Partages existants
  const { data: existingShares = [], refetch: refetchShares } = useQuery({
    queryKey: ['shares', entityType, token],
    queryFn: () => fetchShares(entityType, token!),
    enabled: !!token,
  })

  // Map id → label pour l'affichage des partages existants
  const entityMap = new Map(entities.map((e) => [e.id, e]))

  const shareMutation = useMutation({
    mutationFn: () => createShares(entityType, [...selectedIds], recipients.map((r) => r.id), token!),
    onSuccess: (res) => {
      setSuccessMsg(`${res.created} partage(s) créé(s)${res.skipped ? ` · ${res.skipped} déjà existant(s)` : ''}`)
      setSelectedIds(new Set())
      setRecipients([])
      refetchShares()
      queryClient.invalidateQueries({ queryKey: ['shares', entityType] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeShare(id, token!),
    onSuccess: () => refetchShares(),
  })

  function toggleEntity(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function addRecipient(user: PlatformUser) {
    setRecipients((prev) => [...prev, user])
    setSearch('')
  }

  const canSubmit = selectedIds.size > 0 && recipients.length > 0 && !shareMutation.isPending

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Sélection des entités */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Éléments à partager
              {selectedIds.size > 0 && (
                <span className="ml-1.5 text-primary">({selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''})</span>
              )}
            </h3>

            {/* Tout sélectionner */}
            {entities.length > 1 && (
              <button
                className="text-xs text-primary hover:underline mb-2"
                onClick={() => {
                  if (selectedIds.size === entities.length) setSelectedIds(new Set())
                  else setSelectedIds(new Set(entities.map((e) => e.id)))
                }}
              >
                {selectedIds.size === entities.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            )}

            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {entities.map((entity) => (
                <label
                  key={entity.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                    selectedIds.has(entity.id)
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(entity.id)}
                    onChange={() => toggleEntity(entity.id)}
                    className="rounded shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{entity.label}</span>
                    {entity.sublabel && <span className="text-xs text-muted-foreground">{entity.sublabel}</span>}
                  </span>
                  {entity.badge && (
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', BADGE_CLASS[entity.badge.variant])}>
                      {entity.badge.label}
                    </span>
                  )}
                </label>
              ))}
              {entities.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">Aucun élément disponible.</p>
              )}
            </div>
          </section>

          {/* Sélection des destinataires */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Destinataires
            </h3>

            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
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
              <div className="mt-1 border border-border rounded-lg overflow-hidden">
                {searchResults.map((u) => {
                  const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ')
                  return (
                    <button
                      key={u.id}
                      onClick={() => addRecipient(u)}
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
          </section>

          {/* Partages actifs */}
          {existingShares.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Partages actifs ({existingShares.length})
              </h3>
              <div className="space-y-1">
                {existingShares.map((s) => {
                  const entity = s.entityId ? entityMap.get(s.entityId) : null
                  return (
                    <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm group">
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="font-medium truncate">{entity?.label ?? s.entityId ?? '—'}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-muted-foreground truncate">{s.recipientUser?.email}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          ({ROLE_LABELS[s.recipientUser?.globalRole] ?? s.recipientUser?.globalRole})
                        </span>
                      </div>
                      <button
                        onClick={() => revokeMutation.mutate(s.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                        title="Révoquer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {successMsg && (
            <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{successMsg}</p>
          )}
          {shareMutation.isError && (
            <p className="text-sm text-destructive">{(shareMutation.error as Error).message}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
          <Button size="sm" onClick={() => shareMutation.mutate()} disabled={!canSubmit}>
            {shareMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Partage…</>
              : <><Share2 className="h-3.5 w-3.5 mr-1.5" />Partager</>
            }
          </Button>
        </div>
      </div>
    </div>
  )
}
