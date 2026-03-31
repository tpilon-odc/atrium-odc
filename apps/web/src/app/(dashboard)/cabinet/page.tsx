'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Trash2, Plus, X, UserCheck, Building, Globe, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { cabinetApi, memberApi, displayName, type CabinetMember } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  member: 'Membre',
}

// ── Section informations cabinet ──────────────────────────────────────────────

const cabinetSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  siret: z.string().optional(),
  oriasNumber: z.string().optional(),
})
type CabinetForm = z.infer<typeof cabinetSchema>

function CabinetSection() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data } = useQuery({
    queryKey: ['cabinet-me', token],
    queryFn: () => cabinetApi.getMe(token!),
    enabled: !!token,
  })
  const cabinet = data?.data.cabinet as any

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CabinetForm>({
    resolver: zodResolver(cabinetSchema),
    values: cabinet ? { name: cabinet.name, siret: cabinet.siret ?? '', oriasNumber: cabinet.oriasNumber ?? '' } : undefined,
  })

  const mutation = useMutation({
    mutationFn: (d: CabinetForm) => cabinetApi.update(d, token!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cabinet-me'] }); setEditing(false) },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Building className="h-4 w-4" />
          Informations du cabinet
        </h3>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nom du cabinet <span className="text-destructive">*</span></Label>
            <Input {...register('name')} className="text-sm" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">SIRET</Label>
              <Input {...register('siret')} placeholder="12345678901234" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">N° ORIAS</Label>
              <Input {...register('oriasNumber')} placeholder="12345678" className="text-sm" />
            </div>
          </div>
          {mutation.isError && <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { reset(); setEditing(false) }}>Annuler</Button>
          </div>
        </form>
      ) : (
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Nom</dt>
            <dd className="font-medium">{cabinet?.name}</dd>
          </div>
          {cabinet?.siret && (
            <div>
              <dt className="text-xs text-muted-foreground">SIRET</dt>
              <dd>{cabinet.siret}</dd>
            </div>
          )}
          {cabinet?.oriasNumber && (
            <div>
              <dt className="text-xs text-muted-foreground">N° ORIAS</dt>
              <dd>{cabinet.oriasNumber}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}

// ── Section profil public ─────────────────────────────────────────────────────

const cabinetProfileSchema = z.object({
  description: z.string().optional(),
  city: z.string().optional(),
  website: z.string().url('URL invalide').optional().or(z.literal('')),
})
type CabinetProfileForm = z.infer<typeof cabinetProfileSchema>

function CabinetProfileSection() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const membersQuery = useQuery({
    queryKey: ['members', token],
    queryFn: () => memberApi.list(token!),
    enabled: !!token,
  })
  const members = membersQuery.data?.data.members ?? []
  const currentMember = members.find((m: CabinetMember) => m.userId === user?.id)
  const isOwner = currentMember?.role === 'owner'

  const { data } = useQuery({
    queryKey: ['cabinet-me', token],
    queryFn: () => cabinetApi.getMe(token!),
    enabled: !!token,
  })
  const cabinet = data?.data.cabinet as any

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CabinetProfileForm>({
    resolver: zodResolver(cabinetProfileSchema),
    values: cabinet
      ? { description: cabinet.description ?? '', city: cabinet.city ?? '', website: cabinet.website ?? '' }
      : undefined,
  })

  const mutation = useMutation({
    mutationFn: (d: CabinetProfileForm) => cabinetApi.update(d, token!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cabinet-me'] }); setEditing(false) },
  })

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => cabinetApi.uploadLogo(file, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cabinet-me'] }),
  })

  const deleteLogoMutation = useMutation({
    mutationFn: () => cabinetApi.deleteLogo(token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cabinet-me'] }),
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Profil public
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Visible par tous les utilisateurs connectés sur la plateforme</p>
        </div>
        {isOwner && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isOwner && (
        <div className="flex items-center gap-4 pb-2 border-b border-border">
          <div className="h-16 w-16 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
            {cabinet?.logoUrl
              ? <img src={cabinet.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
              : <Building className="h-6 w-6 text-muted-foreground/40" />
            }
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Logo du cabinet</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou SVG · 2 Mo max</p>
            <div className="flex gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadLogoMutation.mutate(file)
                  e.target.value = ''
                }}
              />
              <Button type="button" size="sm" variant="outline" className="text-xs h-7"
                disabled={uploadLogoMutation.isPending} onClick={() => logoInputRef.current?.click()}>
                {uploadLogoMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Changer'}
              </Button>
              {cabinet?.logoUrl && (
                <Button type="button" size="sm" variant="ghost" className="text-xs h-7 text-destructive hover:text-destructive"
                  disabled={deleteLogoMutation.isPending} onClick={() => deleteLogoMutation.mutate()}>
                  {deleteLogoMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Supprimer'}
                </Button>
              )}
            </div>
            {(uploadLogoMutation.isError || deleteLogoMutation.isError) && (
              <p className="text-xs text-destructive">
                {((uploadLogoMutation.error || deleteLogoMutation.error) as Error).message}
              </p>
            )}
          </div>
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Décrivez votre cabinet : spécialités, valeurs, approche…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Ville</Label>
              <Input {...register('city')} placeholder="Paris" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Site web</Label>
              <Input {...register('website')} placeholder="https://www.cabinet.fr" className="text-sm" />
              {errors.website && <p className="text-xs text-destructive">{errors.website.message}</p>}
            </div>
          </div>
          {mutation.isError && <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { reset(); setEditing(false) }}>Annuler</Button>
          </div>
        </form>
      ) : (
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Description</dt>
            <dd className="whitespace-pre-wrap">{cabinet?.description || <span className="text-muted-foreground italic">Non renseignée</span>}</dd>
          </div>
          {cabinet?.city && (
            <div>
              <dt className="text-xs text-muted-foreground">Ville</dt>
              <dd>{cabinet.city}</dd>
            </div>
          )}
          {cabinet?.website && (
            <div>
              <dt className="text-xs text-muted-foreground">Site web</dt>
              <dd><a href={cabinet.website} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{cabinet.website}</a></dd>
            </div>
          )}
          {!isOwner && (
            <p className="text-xs text-muted-foreground italic">Seul le propriétaire du cabinet peut modifier ces informations.</p>
          )}
        </dl>
      )}
    </div>
  )
}

// ── Section membres ───────────────────────────────────────────────────────────

function MembersSection() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<null | 'invite' | 'external'>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [perms, setPerms] = useState({ suppliers: false, products: false, contacts: false })
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)
  const [extForm, setExtForm] = useState({ firstName: '', lastName: '', email: '', title: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['members', token],
    queryFn: () => memberApi.list(token!),
    enabled: !!token,
  })
  const members = data?.data.members ?? []
  const currentMember = members.find((m) => m.userId === user?.id)
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin'
  const isOwner = currentMember?.role === 'owner'

  const inviteMutation = useMutation({
    mutationFn: () => memberApi.invite({ email, role, canManageSuppliers: perms.suppliers, canManageProducts: perms.products, canManageContacts: perms.contacts }, token!),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['members'] }); setMode(null); setEmail(''); setLastInviteUrl(res.data.inviteUrl ?? null) },
  })

  const addExternalMutation = useMutation({
    mutationFn: () => memberApi.addExternal({ firstName: extForm.firstName, lastName: extForm.lastName, email: extForm.email || undefined, title: extForm.title || undefined }, token!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members'] }); setMode(null); setExtForm({ firstName: '', lastName: '', email: '', title: '' }) },
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => memberApi.remove(memberId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  })

  const togglePublicMutation = useMutation({
    mutationFn: ({ memberId, isPublic }: { memberId: string; isPublic: boolean }) => memberApi.update(memberId, { isPublic }, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  })

  const [editingExtId, setEditingExtId] = useState<string | null>(null)
  const [editExtForm, setEditExtForm] = useState({ firstName: '', lastName: '', email: '', title: '' })

  const updateExternalMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: typeof editExtForm }) =>
      memberApi.update(memberId, { externalFirstName: data.firstName, externalLastName: data.lastName, externalEmail: data.email || undefined, externalTitle: data.title || undefined }, token!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members'] }); setEditingExtId(null) },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          Membres ({members.length})
        </h3>
        {canManage && !mode && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode('external')}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ajouter sans compte
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('invite')}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Inviter
            </Button>
          </div>
        )}
      </div>

      {mode === 'external' && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Ajouter un collaborateur sans compte</span>
            <button onClick={() => setMode(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Prénom <span className="text-destructive">*</span></Label>
              <Input value={extForm.firstName} onChange={(e) => setExtForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Jean" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nom <span className="text-destructive">*</span></Label>
              <Input value={extForm.lastName} onChange={(e) => setExtForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Dupont" className="text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Titre / Poste</Label>
            <Input value={extForm.title} onChange={(e) => setExtForm((f) => ({ ...f, title: e.target.value }))} placeholder="ex: Conseiller en gestion de patrimoine" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email (optionnel)</Label>
            <Input value={extForm.email} onChange={(e) => setExtForm((f) => ({ ...f, email: e.target.value }))} placeholder="jean.dupont@cabinet.fr" className="text-sm" />
          </div>
          {addExternalMutation.isError && <p className="text-xs text-destructive">{(addExternalMutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addExternalMutation.mutate()} disabled={addExternalMutation.isPending || !extForm.firstName.trim() || !extForm.lastName.trim()}>
              {addExternalMutation.isPending ? 'Ajout…' : 'Ajouter'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode(null)}>Annuler</Button>
          </div>
        </div>
      )}

      {mode === 'invite' && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Inviter un collaborateur</span>
            <button onClick={() => setMode(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="collaborateur@cabinet.fr" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Rôle</Label>
            <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
              <option value="member">Membre</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Permissions</Label>
            {[
              { key: 'suppliers' as const, label: 'Gérer les fournisseurs' },
              { key: 'products' as const, label: 'Gérer les produits' },
              { key: 'contacts' as const, label: 'Gérer les contacts' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={perms[key]} onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.checked }))} className="rounded" />
                {label}
              </label>
            ))}
          </div>
          {inviteMutation.isError && <p className="text-xs text-destructive">{(inviteMutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending || !email}>
              {inviteMutation.isPending ? 'Invitation…' : 'Inviter'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode(null)}>Annuler</Button>
          </div>
        </div>
      )}

      {lastInviteUrl && (
        <div className="border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Lien d&apos;invitation (valable 24h)</p>
          <div className="flex items-center gap-2">
            <input readOnly value={lastInviteUrl} className="flex-1 text-xs bg-white dark:bg-background border border-border rounded px-2 py-1 truncate" />
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigator.clipboard.writeText(lastInviteUrl)}>Copier</Button>
          </div>
          <button className="text-xs text-muted-foreground underline" onClick={() => setLastInviteUrl(null)}>Fermer</button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const isExternal = !m.user
            const displayedName = isExternal
              ? `${m.externalFirstName ?? ''} ${m.externalLastName ?? ''}`.trim()
              : `${m.user?.firstName ?? ''} ${m.user?.lastName ?? ''}`.trim()
            const displayedEmail = isExternal ? m.externalEmail : m.user?.email
            const isEditingThis = editingExtId === m.id

            return (
              <li key={m.id} className="py-2 border-b border-border last:border-0 space-y-2">
                {isEditingThis ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={editExtForm.firstName} onChange={(e) => setEditExtForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Prénom" className="text-sm h-8" />
                      <Input value={editExtForm.lastName} onChange={(e) => setEditExtForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Nom" className="text-sm h-8" />
                    </div>
                    <Input value={editExtForm.title} onChange={(e) => setEditExtForm((f) => ({ ...f, title: e.target.value }))} placeholder="Titre / Poste" className="text-sm h-8" />
                    <Input value={editExtForm.email} onChange={(e) => setEditExtForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email (optionnel)" className="text-sm h-8" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateExternalMutation.mutate({ memberId: m.id, data: editExtForm })} disabled={updateExternalMutation.isPending || !editExtForm.firstName.trim() || !editExtForm.lastName.trim()}>
                        {updateExternalMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingExtId(null)}>Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      {displayedName && <p className="text-sm font-medium truncate">{displayedName}</p>}
                      {m.externalTitle && <p className="text-xs text-muted-foreground truncate">{m.externalTitle}</p>}
                      {displayedEmail && (
                        <p className={cn('truncate', displayedName ? 'text-xs text-muted-foreground' : 'text-sm font-medium')}>{displayedEmail}</p>
                      )}
                      <div className="flex gap-1.5 flex-wrap mt-0.5">
                        {isExternal ? (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Sans compte</span>
                        ) : (
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                            m.role === 'owner' ? 'bg-primary/10 text-primary' :
                            m.role === 'admin' ? 'bg-orange-100 text-orange-700' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {ROLE_LABELS[m.role]}
                          </span>
                        )}
                        {m.canManageSuppliers && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Fournisseurs</span>}
                        {m.canManageProducts && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Produits</span>}
                        {m.canManageContacts && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Contacts</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner && (
                        <button
                          onClick={() => togglePublicMutation.mutate({ memberId: m.id, isPublic: !m.isPublic })}
                          className={cn('text-xs px-2.5 py-1 rounded-full font-medium transition-colors',
                            m.isPublic ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          )}
                        >
                          {m.isPublic ? 'Visible' : 'Masqué'}
                        </button>
                      )}
                      {isExternal && canManage && (
                        <button
                          onClick={() => { setEditExtForm({ firstName: m.externalFirstName ?? '', lastName: m.externalLastName ?? '', email: m.externalEmail ?? '', title: m.externalTitle ?? '' }); setEditingExtId(m.id) }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canManage && m.role !== 'owner' && m.userId !== user?.id && (
                        <button
                          onClick={() => confirm(`Retirer ${displayedName || displayedEmail || 'ce membre'} ?`) && removeMutation.mutate(m.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CabinetPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold">Mon Cabinet</h2>
        <p className="text-muted-foreground mt-1">Informations, profil public et membres de votre cabinet.</p>
      </div>
      <CabinetSection />
      <CabinetProfileSection />
      <MembersSection />
    </div>
  )
}
