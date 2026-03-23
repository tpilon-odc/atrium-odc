'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Trash2, Plus, X, ShieldCheck, UserCheck, Building, User } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { cabinetApi, memberApi, storageConfigApi, userApi, displayName, type CabinetMember, type StorageConfig } from '@/lib/api'
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

// ── Section membres ───────────────────────────────────────────────────────────

function MembersSection() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [perms, setPerms] = useState({ suppliers: false, products: false, contacts: false })

  const { data, isLoading } = useQuery({
    queryKey: ['members', token],
    queryFn: () => memberApi.list(token!),
    enabled: !!token,
  })
  const members = data?.data.members ?? []
  const currentMember = members.find((m) => m.userId === user?.id)
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin'

  const inviteMutation = useMutation({
    mutationFn: () => memberApi.invite({
      email,
      role,
      canManageSuppliers: perms.suppliers,
      canManageProducts: perms.products,
      canManageContacts: perms.contacts,
    }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      setInviting(false)
      setEmail('')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => memberApi.remove(memberId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          Membres ({members.length})
        </h3>
        {canManage && !inviting && (
          <Button size="sm" variant="outline" onClick={() => setInviting(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Inviter
          </Button>
        )}
      </div>

      {inviting && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Inviter un collaborateur</span>
            <button onClick={() => setInviting(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
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
            <Button size="sm" variant="outline" onClick={() => setInviting(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                {(m.user.firstName || m.user.lastName) && (
                  <p className="text-sm font-medium truncate">{`${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim()}</p>
                )}
                <p className={cn('truncate', m.user.firstName || m.user.lastName ? 'text-xs text-muted-foreground' : 'text-sm font-medium')}>{m.user.email}</p>
                <div className="flex gap-1.5 flex-wrap mt-0.5">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    m.role === 'owner' ? 'bg-primary/10 text-primary' :
                    m.role === 'admin' ? 'bg-orange-100 text-orange-700' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {ROLE_LABELS[m.role]}
                  </span>
                  {m.canManageSuppliers && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Fournisseurs</span>}
                  {m.canManageProducts && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Produits</span>}
                  {m.canManageContacts && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Contacts</span>}
                </div>
              </div>
              {canManage && m.role !== 'owner' && m.userId !== user?.id && (
                <button
                  onClick={() => confirm(`Retirer ${m.user.email} ?`) && removeMutation.mutate(m.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ParametresPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-semibold">Paramètres</h2>
        <p className="text-muted-foreground mt-1">Gérez votre cabinet, vos membres et vos configurations.</p>
      </div>
      <ProfileSection />
      <CabinetSection />
      <MembersSection />
      <StorageSection />
    </div>
  )
}
