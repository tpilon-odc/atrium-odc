'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Copy, Check, Users, ShieldCheck, Building2, Search, Pencil, X, Ban, Link2, Unlink } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminApi, supplierApi, type PlatformUser } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ROLE_CONFIG: Record<string, { label: string; description: string; icon: React.ElementType; color: string }> = {
  cabinet_user:   { label: 'Cabinet',           description: 'Cabinet de conseil en gestion de patrimoine',    icon: Users,       color: 'text-muted-foreground bg-muted' },
  chamber:        { label: 'Chambre',            description: 'Organisme professionnel (ex: ANACOFI, CNCGP…)', icon: Building2,   color: 'text-blue-600 bg-blue-50' },
  regulator:      { label: 'Régulateur',         description: 'Autorité de supervision (ex: AMF, ACPR…)',      icon: ShieldCheck, color: 'text-amber-600 bg-amber-50' },
  platform_admin: { label: 'Admin plateforme',   description: "Accès complet à l'administration",              icon: Users,       color: 'text-purple-600 bg-purple-50' },
  supplier:       { label: 'Fournisseur',        description: 'Peut gérer ses propres fiches fournisseur',     icon: Building2,   color: 'text-green-600 bg-green-50' },
}

const INVITE_ROLES = ['chamber', 'regulator', 'platform_admin', 'supplier'] as const

// ── Formulaire d'invitation ──────────────────────────────────────────────────

function InviteForm({ onClose }: { onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<typeof INVITE_ROLES[number]>('chamber')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: () => adminApi.invitePlatformUser({ email, firstName, lastName, globalRole: role }, token!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] })
      setInviteUrl(res.data.inviteUrl)
    },
  })

  const copyLink = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (inviteUrl) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 text-success">
          <Check className="h-4 w-4" />
          <p className="font-medium text-sm">Compte créé — copiez le lien d'invitation</p>
        </div>
        <div className="flex gap-2">
          <Input value={inviteUrl} readOnly className="text-xs font-mono flex-1 bg-muted" />
          <Button size="sm" variant="outline" onClick={copyLink}>
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ce lien est à usage unique. L'utilisateur définira son mot de passe lors de sa première connexion.
        </p>
        <Button size="sm" onClick={onClose}>Fermer</Button>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h3 className="font-medium">Inviter un utilisateur plateforme</h3>

      <div className="space-y-1.5">
        <Label className="text-xs">Rôle <span className="text-destructive">*</span></Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {INVITE_ROLES.map((key) => {
            const cfg = ROLE_CONFIG[key]
            const Icon = cfg.icon
            return (
              <button
                key={key}
                type="button"
                onClick={() => setRole(key)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors',
                  role === key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                )}
              >
                <Icon className={cn('h-4 w-4', role === key ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-xs font-medium', role === key ? 'text-primary' : 'text-foreground')}>
                  {cfg.label}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">{ROLE_CONFIG[role].description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Prénom <span className="text-destructive">*</span></Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nom <span className="text-destructive">*</span></Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" className="text-sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contact@chambre-cgp.fr"
          className="text-sm"
        />
      </div>

      {mutation.isError && (
        <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !email.trim() || !firstName.trim() || !lastName.trim()}
        >
          {mutation.isPending ? 'Création…' : 'Créer et inviter'}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  )
}

// ── Ligne utilisateur ────────────────────────────────────────────────────────

function SupplierLinksPanel({ user, token }: { user: PlatformUser; token: string }) {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const { data: linksData } = useQuery({
    queryKey: ['admin-supplier-links', user.id, token],
    queryFn: () => adminApi.getSupplierLinks(user.id, token),
    enabled: !!token,
  })
  const links = linksData?.data.links ?? []

  const { data: searchData } = useQuery({
    queryKey: ['suppliers-search', token, q],
    queryFn: () => supplierApi.list(token, { search: q, limit: 8 }),
    enabled: !!token && q.length >= 1,
  })
  const results = (searchData?.data.suppliers ?? []).filter((s) => !links.some((l) => l.supplier.id === s.id))

  const linkMutation = useMutation({
    mutationFn: (supplierId: string) => adminApi.linkSupplierUser({ userId: user.id, supplierId }, token),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-supplier-links', user.id] }); setQ(''); setOpen(false) },
  })
  const unlinkMutation = useMutation({
    mutationFn: (supplierId: string) => adminApi.unlinkSupplierUser({ userId: user.id, supplierId }, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-supplier-links', user.id] }),
  })

  return (
    <div className="border-t border-border px-4 py-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Fiches fournisseur gérées</p>
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-sm">
              <span>{l.supplier.name}</span>
              {l.supplier.category && <span className="text-xs text-muted-foreground">· {l.supplier.category}</span>}
              <button onClick={() => unlinkMutation.mutate(l.supplier.id)} className="text-muted-foreground hover:text-destructive ml-1">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="relative max-w-xs">
        <Input
          placeholder="Lier une fiche fournisseur…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => q && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="text-sm"
        />
        {open && results.length > 0 && (
          <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-md overflow-hidden">
            {results.map((s) => (
              <button
                key={s.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                onMouseDown={() => linkMutation.mutate(s.id)}
              >
                <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium">{s.name}</span>
                {s.category && <span className="text-xs text-muted-foreground">{s.category}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UserRow({
  user,
  currentUserId,
  onUpdate,
}: {
  user: PlatformUser
  currentUserId: string
  onUpdate: (data: { globalRole?: string; isActive?: boolean }) => void
}) {
  const { token } = useAuthStore()
  const isSelf = user.id === currentUserId
  const [editing, setEditing] = useState(false)
  const [showSupplierLinks, setShowSupplierLinks] = useState(false)
  const [role, setRole] = useState(user.globalRole)
  const cfg = ROLE_CONFIG[user.globalRole]
  const Icon = cfg?.icon ?? Users
  const isNonCabinet = user.globalRole !== 'cabinet_user'
  const isDisabled = user.isActive === false

  return (
    <div className={cn('bg-card border border-border rounded-lg overflow-hidden', isDisabled && 'opacity-60')}>
      <div className="flex items-center gap-4 px-4 py-3 group">
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0', cfg?.color ?? 'bg-muted text-muted-foreground')}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">
              {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
            </p>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', cfg?.color ?? 'bg-muted text-muted-foreground')}>
              {cfg?.label ?? user.globalRole}
            </span>
            {isDisabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-destructive/10 text-destructive shrink-0">
                Désactivé
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <p className="text-xs text-muted-foreground shrink-0">
          {new Date(user.createdAt!).toLocaleDateString('fr-FR')}
        </p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          {user.globalRole === 'supplier' && (
            <button
              onClick={() => setShowSupplierLinks((v) => !v)}
              title="Gérer les fiches liées"
              className="text-muted-foreground hover:text-foreground"
            >
              {showSupplierLinks ? <Unlink className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            </button>
          )}
          {isNonCabinet && (
            <button
              onClick={() => setEditing((v) => !v)}
              title="Modifier le rôle"
              className="text-muted-foreground hover:text-foreground"
            >
              {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            onClick={() => {
              if (isSelf) return
              const action = isDisabled ? 'réactiver' : 'désactiver'
              if (confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} le compte de ${user.email} ?`)) {
                onUpdate({ isActive: !isDisabled })
              }
            }}
            title={isSelf ? 'Impossible de désactiver votre propre compte' : isDisabled ? 'Réactiver' : 'Désactiver'}
            disabled={isSelf}
            className={cn(
              'transition-colors',
              isSelf
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : isDisabled ? 'text-muted-foreground hover:text-success' : 'text-muted-foreground hover:text-destructive'
            )}
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-border px-4 py-3 flex items-center gap-3">
          <p className="text-xs text-muted-foreground shrink-0">Rôle :</p>
          <div className="flex gap-2 flex-wrap flex-1">
            {INVITE_ROLES.map((key) => {
              const c = ROLE_CONFIG[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRole(key)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
                    role === key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          <Button
            size="sm"
            disabled={role === user.globalRole}
            onClick={() => { onUpdate({ globalRole: role }); setEditing(false) }}
          >
            Enregistrer
          </Button>
        </div>
      )}

      {showSupplierLinks && token && (
        <SupplierLinksPanel user={user} token={token} />
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const ROLE_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'cabinet_user', label: 'Cabinets' },
  { value: 'chamber', label: 'Chambres' },
  { value: 'regulator', label: 'Régulateurs' },
  { value: 'platform_admin', label: 'Admins' },
  { value: 'supplier', label: 'Fournisseurs' },
]

export default function PlatformUsersPage() {
  const { token, user: currentUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['platform-users', token, roleFilter, search],
    queryFn: () => adminApi.listPlatformUsers(token!, {
      role: roleFilter || undefined,
      search: search || undefined,
    }),
    enabled: !!token,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { globalRole?: string; isActive?: boolean } }) =>
      adminApi.updatePlatformUser(id, data, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-users'] }),
  })

  const allUsers = data?.data.users ?? []
  const users = showInactive ? allUsers : allUsers.filter((u) => u.isActive !== false)

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Utilisateurs</h2>
          <p className="text-muted-foreground mt-1">Tous les comptes de la plateforme.</p>
        </div>
        {!inviting && (
          <Button size="sm" onClick={() => setInviting(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Inviter
          </Button>
        )}
      </div>

      {inviting && <InviteForm onClose={() => setInviting(false)} />}

      {/* Filtres */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {ROLE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRoleFilter(value)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                roleFilter === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto">
            <button
              onClick={() => setShowInactive((v) => !v)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full font-medium border transition-colors',
                showInactive
                  ? 'border-destructive/50 bg-destructive/10 text-destructive'
                  : 'border-border text-muted-foreground hover:bg-muted/80'
              )}
            >
              {showInactive ? 'Masquer les inactifs' : 'Afficher les inactifs'}
              {!showInactive && allUsers.filter((u) => u.isActive === false).length > 0 && (
                <span className="ml-1.5 bg-destructive/20 text-destructive px-1 rounded-full">
                  {allUsers.filter((u) => u.isActive === false).length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Aucun utilisateur trouvé</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || roleFilter ? 'Aucun résultat pour ces filtres.' : 'Aucun compte enregistré.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{users.length} utilisateur{users.length > 1 ? 's' : ''}</p>
          {users.map((u) => (
            <UserRow key={u.id} user={u} currentUserId={currentUser?.id ?? ''} onUpdate={(data) => updateMutation.mutate({ id: u.id, data })} />
          ))}
        </div>
      )}
    </div>
  )
}
