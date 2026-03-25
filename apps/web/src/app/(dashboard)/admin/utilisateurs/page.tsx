'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Trash2, Copy, Check, Users, ShieldCheck, Building2, Search } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminApi, type PlatformUser } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ROLE_CONFIG: Record<string, { label: string; description: string; icon: React.ElementType; color: string }> = {
  cabinet_user:   { label: 'Cabinet',           description: 'Cabinet de conseil en gestion de patrimoine',    icon: Users,       color: 'text-muted-foreground bg-muted' },
  chamber:        { label: 'Chambre',            description: 'Organisme professionnel (ex: ANACOFI, CNCGP…)', icon: Building2,   color: 'text-blue-600 bg-blue-50' },
  regulator:      { label: 'Régulateur',         description: 'Autorité de supervision (ex: AMF, ACPR…)',      icon: ShieldCheck, color: 'text-amber-600 bg-amber-50' },
  platform_admin: { label: 'Admin plateforme',   description: "Accès complet à l'administration",              icon: Users,       color: 'text-purple-600 bg-purple-50' },
}

const INVITE_ROLES = ['chamber', 'regulator', 'platform_admin'] as const

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
        <div className="grid grid-cols-3 gap-2">
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

function UserRow({ user, onDelete }: { user: PlatformUser; onDelete: () => void }) {
  const cfg = ROLE_CONFIG[user.globalRole]
  const Icon = cfg?.icon ?? Users
  const canDelete = user.globalRole !== 'cabinet_user'

  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-lg px-4 py-3 group">
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
        </div>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>
      <p className="text-xs text-muted-foreground shrink-0">
        {new Date(user.createdAt!).toLocaleDateString('fr-FR')}
      </p>
      {canDelete && (
        <button
          onClick={() => confirm(`Désactiver le compte de ${user.email} ?`) && onDelete()}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
          title="Désactiver"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {!canDelete && <div className="w-5 shrink-0" />}
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
]

export default function PlatformUsersPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['platform-users', token, roleFilter, search],
    queryFn: () => adminApi.listPlatformUsers(token!, {
      role: roleFilter || undefined,
      search: search || undefined,
    }),
    enabled: !!token,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePlatformUser(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-users'] }),
  })

  const users = data?.data.users ?? []

  return (
    <div className="space-y-6 max-w-3xl">
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
        <div className="flex gap-2 flex-wrap">
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
            <UserRow key={u.id} user={u} onDelete={() => deleteMutation.mutate(u.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
