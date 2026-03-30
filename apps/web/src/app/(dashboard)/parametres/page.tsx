'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Trash2, Plus, X, ShieldCheck, UserCheck, Building, User, CalendarDays, Copy, Eye, EyeOff, RefreshCw, Download, Loader2, PackageOpen, Database, AlertTriangle, CheckCircle2, Globe } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { cabinetApi, memberApi, storageConfigApi, userApi, eventApi, exportJobApi, gdprApi, consentApi, displayName, type CabinetMember, type StorageConfig, type ExportJob, type GdprRequest, type ConsentRecord } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  member: 'Membre',
}

const PROVIDER_LABELS: Record<string, string> = {
  aws: 'AWS S3',
  gdrive: 'Google Drive',
  sharepoint: 'SharePoint',
  other: 'Autre',
}

// ── Section profil ────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})
type ProfileForm = z.infer<typeof profileSchema>

function ProfileSection() {
  const { token, user, setAuth } = useAuthStore()
  const [editing, setEditing] = useState(false)

  const { register, handleSubmit, reset } = useForm<ProfileForm>({
    values: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' },
  })

  const mutation = useMutation({
    mutationFn: (d: ProfileForm) => userApi.updateProfile(d, token!),
    onSuccess: (res) => {
      const updated = res.data.user
      setAuth(token!, { ...user!, firstName: updated.firstName, lastName: updated.lastName })
      setEditing(false)
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <User className="h-4 w-4" />
          Mon profil
        </h3>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Prénom</Label>
              <Input {...register('firstName')} placeholder="Jean" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nom</Label>
              <Input {...register('lastName')} placeholder="Dupont" className="text-sm" />
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
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Nom complet</dt>
            <dd>{user?.firstName || user?.lastName ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : <span className="text-muted-foreground italic">Non renseigné</span>}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

// ── Section cabinet ───────────────────────────────────────────────────────────

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinet-me'] })
      setEditing(false)
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinet-me'] })
      setEditing(false)
    },
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

      {/* Logo */}
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs h-7"
                disabled={uploadLogoMutation.isPending}
                onClick={() => logoInputRef.current?.click()}
              >
                {uploadLogoMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Changer'}
              </Button>
              {cabinet?.logoUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 text-destructive hover:text-destructive"
                  disabled={deleteLogoMutation.isPending}
                  onClick={() => deleteLogoMutation.mutate()}
                >
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
    mutationFn: () => memberApi.invite({
      email,
      role,
      canManageSuppliers: perms.suppliers,
      canManageProducts: perms.products,
      canManageContacts: perms.contacts,
    }, token!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      setMode(null)
      setEmail('')
      setLastInviteUrl(res.data.inviteUrl ?? null)
    },
  })

  const addExternalMutation = useMutation({
    mutationFn: () => memberApi.addExternal({
      firstName: extForm.firstName,
      lastName: extForm.lastName,
      email: extForm.email || undefined,
      title: extForm.title || undefined,
    }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      setMode(null)
      setExtForm({ firstName: '', lastName: '', email: '', title: '' })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => memberApi.remove(memberId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  })

  const togglePublicMutation = useMutation({
    mutationFn: ({ memberId, isPublic }: { memberId: string; isPublic: boolean }) =>
      memberApi.update(memberId, { isPublic }, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
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

      {/* Formulaire : membre sans compte */}
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

      {/* Formulaire : inviter avec compte */}
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
                <input
                  type="checkbox"
                  checked={perms[key]}
                  onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.checked }))}
                  className="rounded"
                />
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
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => { navigator.clipboard.writeText(lastInviteUrl); }}>
              Copier
            </Button>
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
            return (
              <li key={m.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
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
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
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
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full font-medium transition-colors',
                        m.isPublic
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {m.isPublic ? 'Visible' : 'Masqué'}
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
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Section configs de stockage externe ───────────────────────────────────────

function StorageSection() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [provider, setProvider] = useState('aws')
  const [label, setLabel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  const { data } = useQuery({
    queryKey: ['storage-configs', token],
    queryFn: () => storageConfigApi.list(token!),
    enabled: !!token,
  })
  const configs = data?.data.configs ?? []

  const createMutation = useMutation({
    mutationFn: () => storageConfigApi.create({ provider, label, baseUrl }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-configs'] })
      setAdding(false)
      setLabel('')
      setBaseUrl('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => storageConfigApi.delete(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-configs'] }),
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Stockage externe
        </h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Configurez des accès vers vos espaces de stockage existants (GDrive, SharePoint…) pour référencer des documents externes.
      </p>

      {adding && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Nouvelle config</span>
            <button onClick={() => setAdding(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fournisseur</Label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
                {Object.entries(PROVIDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Libellé</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: GDrive Cabinet" className="text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">URL de base</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://drive.google.com/..." className="text-sm" />
          </div>
          {createMutation.isError && <p className="text-xs text-destructive">{(createMutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !label || !baseUrl}>
              {createMutation.isPending ? 'Création…' : 'Créer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {configs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune configuration de stockage externe.</p>
      ) : (
        <ul className="space-y-2">
          {configs.map((c) => (
            <li key={c.id} className="flex items-center gap-3 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{PROVIDER_LABELS[c.provider] ?? c.provider} · {c.baseUrl}</p>
              </div>
              <button
                onClick={() => confirm(`Supprimer "${c.label}" ?`) && deleteMutation.mutate(c.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Section synchronisation ICS ───────────────────────────────────────────────

function IcsSection() {
  const { token, cabinet } = useAuthStore()
  const queryClient = useQueryClient()
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data } = useQuery({
    queryKey: ['cabinet-ics', token],
    queryFn: () => cabinetApi.getMe(token!),
    enabled: !!token,
  })
  const cabinetData = data?.data.cabinet as any
  const icsUrl = cabinetData && cabinet
    ? eventApi.getIcsUrl(cabinet.id, cabinetData.icsToken)
    : null

  const regenMutation = useMutation({
    mutationFn: () => eventApi.regenerateToken(token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cabinet-ics'] }),
  })

  function handleCopy() {
    if (!icsUrl) return
    navigator.clipboard.writeText(icsUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [platform, setPlatform] = useState<'google' | 'outlook' | 'apple'>('google')

  const instructions = {
    google: 'Ouvrir Google Calendar → "Autres agendas" → "+" → "Via une URL" → coller le lien → "Ajouter un agenda"',
    outlook: 'Ouvrir Outlook → "Ajouter un agenda" → "S\'abonner depuis le web" → coller le lien → "Importer"',
    apple: 'Ouvrir l\'app Calendrier → "Fichier" → "Nouvel abonnement de calendrier…" → coller le lien',
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <CalendarDays className="h-4 w-4" />
        Synchronisation de l'agenda
      </h3>

      <p className="text-xs text-muted-foreground">
        Abonnez-vous à votre agenda depuis Google Calendar, Outlook ou Apple Calendar via ce lien ICS.
      </p>

      <div className="space-y-2">
        <Label className="text-xs">Lien ICS</Label>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 relative">
            <Input
              readOnly
              value={visible && icsUrl ? icsUrl : (icsUrl ? '••••••••••••••••••••••••••••••' : 'Chargement…')}
              className="text-xs font-mono pr-10"
            />
            <button
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={handleCopy} disabled={!icsUrl}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            {copied ? 'Copié !' : 'Copier'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 text-destructive hover:bg-destructive/10"
            onClick={() => confirm('Régénérer le lien ? L\'ancien lien sera invalidé.') && regenMutation.mutate()}
            disabled={regenMutation.isPending}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', regenMutation.isPending && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <Label className="text-xs">Instructions d'abonnement</Label>
        <div className="flex gap-1">
          {(['google', 'outlook', 'apple'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                platform === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {p === 'google' ? 'Google' : p === 'outlook' ? 'Outlook' : 'Apple'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">
          {instructions[platform]}
        </p>
      </div>
    </div>
  )
}

// ── Section export données ────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  DONE: 'Terminé',
  FAILED: 'Erreur',
  EXPIRED: 'Expiré',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-muted text-muted-foreground',
}

function JobRow({ job, downloadUrl }: { job: ExportJob; downloadUrl?: string | null }) {
  return (
    <li className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          Export du {new Date(job.createdAt).toLocaleString('fr-FR')}
        </p>
        {job.completedAt && (
          <p className="text-xs text-muted-foreground">
            Terminé le {new Date(job.completedAt).toLocaleString('fr-FR')}
          </p>
        )}
        {job.error && <p className="text-xs text-destructive mt-0.5">{job.error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[job.status] ?? 'bg-muted text-muted-foreground')}>
          {STATUS_LABELS[job.status] ?? job.status}
        </span>
        {(job.status === 'PENDING' || job.status === 'PROCESSING') && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {job.status === 'DONE' && downloadUrl && (
          <a href={downloadUrl} download className="text-primary hover:underline text-xs flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />
            Télécharger
          </a>
        )}
      </div>
    </li>
  )
}

function ExportSection() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['export-jobs', token],
    queryFn: () => exportJobApi.list(token!),
    enabled: !!token,
    refetchInterval: (query) => {
      const jobs = query.state.data?.data.jobs ?? []
      return jobs.some((j) => j.status === 'PENDING' || j.status === 'PROCESSING') ? 5000 : false
    },
  })
  const jobs = data?.data.jobs ?? []
  const hasPending = jobs.some((j) => j.status === 'PENDING' || j.status === 'PROCESSING')

  // Récupère les URLs de téléchargement pour les jobs DONE
  const doneJobs = jobs.filter((j) => j.status === 'DONE')
  const { data: urlsData } = useQuery({
    queryKey: ['export-job-urls', token, doneJobs.map((j) => j.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(doneJobs.map((j) => exportJobApi.get(j.id, token!)))
      return Object.fromEntries(results.map((r) => [r.data.job.id, r.data.downloadUrl]))
    },
    enabled: !!token && doneJobs.length > 0,
  })

  const createMutation = useMutation({
    mutationFn: () => exportJobApi.create(token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['export-jobs'] }),
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <PackageOpen className="h-4 w-4" />
          Export des données
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || hasPending}
        >
          {createMutation.isPending ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Demande…</>
          ) : (
            <><Download className="h-3.5 w-3.5 mr-1.5" />Lancer un export</>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Exportez l'ensemble des données de votre cabinet (documents, contacts, fournisseurs, conformité, formations) en JSON compressé. Le fichier est disponible pendant 7 jours.
      </p>

      {createMutation.isError && (
        <p className="text-xs text-destructive">{(createMutation.error as Error).message}</p>
      )}

      {isLoading ? (
        <div className="h-10 bg-muted animate-pulse rounded-lg" />
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun export.</p>
      ) : (
        <ul className="space-y-0">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} downloadUrl={urlsData?.[job.id]} />
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Section Mes données (RGPD) ────────────────────────────────────────────────

const GDPR_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  DONE: 'Traitée',
  REJECTED: 'Refusée',
}

const GDPR_STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-600 bg-amber-50 border-amber-200',
  PROCESSING: 'text-blue-600 bg-blue-50 border-blue-200',
  DONE: 'text-green-600 bg-green-50 border-green-200',
  REJECTED: 'text-red-600 bg-red-50 border-red-200',
}

function MesDonneesSection() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [confirmType, setConfirmType] = useState<'ACCESS' | 'ERASURE' | null>(null)
  const [message, setMessage] = useState('')

  const { data: requestsData } = useQuery({
    queryKey: ['gdpr-requests'],
    queryFn: () => gdprApi.listRequests(token!),
    enabled: !!token,
  })

  const { data: consentData } = useQuery({
    queryKey: ['consent-records'],
    queryFn: () => consentApi.list(token!),
    enabled: !!token,
  })

  const requests = (requestsData?.data ?? []) as GdprRequest[]
  const consents = (consentData?.data ?? []) as ConsentRecord[]

  const hasPendingAccess = requests.some((r) => r.type === 'ACCESS' && ['PENDING', 'PROCESSING'].includes(r.status))
  const hasPendingErasure = requests.some((r) => r.type === 'ERASURE' && ['PENDING', 'PROCESSING'].includes(r.status))

  const createMutation = useMutation({
    mutationFn: ({ type, msg }: { type: 'ACCESS' | 'ERASURE'; msg: string }) =>
      gdprApi.createRequest(type, msg || undefined, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gdpr-requests'] })
      setConfirmType(null)
      setMessage('')
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <h3 className="font-medium flex items-center gap-2">
        <Database className="h-4 w-4" />
        Mes données
      </h3>

      {/* Droits RGPD */}
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground text-xs">
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès à vos données et d&apos;un droit à l&apos;effacement.
        </p>

        {/* Droit d'accès */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-sm">Droit d&apos;accès</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Recevez une archive ZIP complète de toutes les données de votre cabinet (délai légal : 30 jours).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={hasPendingAccess}
              onClick={() => setConfirmType('ACCESS')}
              className="shrink-0"
            >
              {hasPendingAccess ? 'En cours...' : 'Demander'}
            </Button>
          </div>
        </div>

        {/* Droit à l'effacement */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <p className="font-medium text-sm text-destructive">Droit à l&apos;effacement</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suppression définitive de toutes vos données privées. Action irréversible.
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              disabled={hasPendingErasure}
              onClick={() => setConfirmType('ERASURE')}
              className="shrink-0"
            >
              {hasPendingErasure ? 'En cours...' : 'Demander'}
            </Button>
          </div>
        </div>
      </div>

      {/* Historique des demandes */}
      {requests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demandes en cours</p>
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-md border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{req.type === 'ACCESS' ? 'Accès' : 'Effacement'}</span>
                  <span className="text-muted-foreground">{new Date(req.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-medium', GDPR_STATUS_COLORS[req.status])}>
                  {GDPR_STATUS_LABELS[req.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique consentements */}
      {consents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consentements</p>
          <div className="space-y-1.5">
            {consents.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                <span>CGU version <strong className="text-foreground">{c.version}</strong> acceptée le {new Date(c.acceptedAt).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal confirmation */}
      {confirmType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h4 className="font-semibold">
              {confirmType === 'ACCESS' ? 'Demande d\'accès aux données' : 'Demande d\'effacement des données'}
            </h4>
            {confirmType === 'ERASURE' && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Cette action est <strong>irréversible</strong>. Toutes vos données privées seront définitivement supprimées.</span>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message (optionnel)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={confirmType === 'ACCESS' ? 'Précisez votre demande si nécessaire...' : 'Motif de la demande...'}
                rows={3}
                className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {createMutation.isError && (
              <p className="text-xs text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setConfirmType(null); setMessage('') }}>
                Annuler
              </Button>
              <Button
                size="sm"
                variant={confirmType === 'ERASURE' ? 'destructive' : 'default'}
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate({ type: confirmType, msg: message })}
              >
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Confirmer la demande
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ParametresPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-semibold">Paramètres</h2>
        <p className="text-muted-foreground mt-1">Gérez votre cabinet, vos membres et vos configurations.</p>
      </div>
      <ProfileSection />
      <CabinetSection />
      <CabinetProfileSection />
      <MembersSection />
      <StorageSection />
      <IcsSection />
      <ExportSection />
      <MesDonneesSection />
    </div>
  )
}
