'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Trash2, Copy, Check, Users, ShieldCheck, Building2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminApi, type PlatformUser } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ROLE_CONFIG: Record<string, { label: string; description: string; icon: React.ElementType; color: string }> = {
  chamber:        { label: 'Chambre',            description: 'Organisme professionnel (ex: ANACOFI, CNCGP…)', icon: Building2,   color: 'text-blue-600 bg-blue-50' },
  regulator:      { label: 'Régulateur',         description: 'Autorité de supervision (ex: AMF, ACPR…)',      icon: ShieldCheck, color: 'text-amber-600 bg-amber-50' },
  platform_admin: { label: 'Admin plateforme',   description: "Accès complet à l'administration",              icon: Users,       color: 'text-purple-600 bg-purple-50' },
}

// ── Formulaire d'invitation ──────────────────────────────────────────────────

function InviteForm({ onClose }: { onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<'chamber' | 'regulator' | 'platform_admin'>('chamber')
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

      {/* Choix du rôle */}
      <div className="space-y-1.5">
        <Label className="text-xs">Rôle <span className="text-destructive">*</span></Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(ROLE_CONFIG) as [string, typeof ROLE_CONFIG[string]][]).map(([key, cfg]) => {
            const Icon = cfg.icon
            return (
              <button
                key={key}
                type="button"
                onClick={() => setRole(key as typeof role)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors',
                  role === key
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
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
        Créé le {new Date(user.createdAt!).toLocaleDateString('fr-FR')}
      </p>
      <button
        onClick={() => confirm(`Désactiver le compte de ${user.email} ?`) && onDelete()}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
        title="Désactiver"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlatformUsersPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['platform-users', token],
    queryFn: () => adminApi.listPlatformUsers(token!),
    enabled: !!token,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePlatformUser(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-users'] }),
  })

  const users = data?.data.users ?? []

  const byRole = {
    chamber:        users.filter((u) => u.globalRole === 'chamber'),
    regulator:      users.filter((u) => u.globalRole === 'regulator'),
    platform_admin: users.filter((u) => u.globalRole === 'platform_admin'),
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Utilisateurs plateforme</h2>
          <p className="text-muted-foreground mt-1">
            Gérez les comptes chambres, régulateurs et administrateurs.
          </p>
        </div>
        {!inviting && (
          <Button size="sm" onClick={() => setInviting(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Inviter
          </Button>
        )}
      </div>

      {inviting && <InviteForm onClose={() => setInviting(false)} />}

      {/* Stats */}
      {!isLoading && users.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(byRole) as [string, PlatformUser[]][]).map(([key, list]) => {
            const cfg = ROLE_CONFIG[key]
            const Icon = cfg.icon
            return (
              <div key={key} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', cfg.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums">{list.length}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}{list.length > 1 ? 's' : ''}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Aucun utilisateur plateforme</p>
          <p className="text-sm text-muted-foreground mt-1">
            Invitez des chambres, régulateurs ou administrateurs via le bouton ci-dessus.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow key={u.id} user={u} onDelete={() => deleteMutation.mutate(u.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
