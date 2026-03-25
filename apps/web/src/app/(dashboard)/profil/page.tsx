'use client'

import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { userApi, displayName } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Camera, Trash2 } from 'lucide-react'

// ── Avatar color ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { label: 'Navy',    bg: 'bg-[#1e3a8a]',  text: 'text-white', value: '#1e3a8a' },
  { label: 'Violet',  bg: 'bg-[#6d28d9]',  text: 'text-white', value: '#6d28d9' },
  { label: 'Teal',    bg: 'bg-[#0f766e]',  text: 'text-white', value: '#0f766e' },
  { label: 'Rose',    bg: 'bg-[#be185d]',  text: 'text-white', value: '#be185d' },
  { label: 'Slate',   bg: 'bg-[#475569]',  text: 'text-white', value: '#475569' },
  { label: 'Amber',   bg: 'bg-[#b45309]',  text: 'text-white', value: '#b45309' },
  { label: 'Indigo',  bg: 'bg-[#4338ca]',  text: 'text-white', value: '#4338ca' },
  { label: 'Emerald', bg: 'bg-[#065f46]',  text: 'text-white', value: '#065f46' },
]

function getStoredColor(userId: string): string {
  if (typeof window === 'undefined') return AVATAR_COLORS[0].value
  return localStorage.getItem(`avatar-color-${userId}`) ?? AVATAR_COLORS[0].value
}

function setStoredColor(userId: string, color: string) {
  localStorage.setItem(`avatar-color-${userId}`, color)
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Administrateur plateforme',
  cabinet_user: 'Membre cabinet',
  chamber: 'Membre chambre',
  regulator: 'Régulateur',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const { token, user, setAuth } = useAuthStore()
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0].value)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
      setAvatarColor(getStoredColor(user.id))
    }
  }, [user?.id])

  const name = displayName(user ?? { email: '', firstName, lastName })
  const initials = getInitials(name)
  const colorConfig = AVATAR_COLORS.find((c) => c.value === avatarColor) ?? AVATAR_COLORS[0]

  function handleColorChange(color: string) {
    setAvatarColor(color)
    if (user) setStoredColor(user.id, color)
  }

  const mutation = useMutation({
    mutationFn: () => userApi.updateProfile(
      { firstName: firstName.trim() || null, lastName: lastName.trim() || null },
      token!
    ),
    onSuccess: (res) => {
      const updated = res.data.user
      setAuth(token!, { ...user!, firstName: updated.firstName, lastName: updated.lastName })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => userApi.uploadAvatar(file, token!),
    onSuccess: (res) => {
      const updated = res.data.user
      setAuth(token!, { ...user!, avatarUrl: updated.avatarUrl })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => userApi.deleteAvatar(token!),
    onSuccess: () => {
      setAuth(token!, { ...user!, avatarUrl: null })
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
    e.target.value = ''
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Mon profil</h2>
        <p className="text-muted-foreground mt-1 text-sm">Personnalisez votre identité sur la plateforme.</p>
      </div>

      {/* Avatar */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-6">
          {/* Aperçu avatar */}
          <div className="relative shrink-0">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={name}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  'h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold select-none transition-colors',
                  colorConfig.bg,
                  colorConfig.text
                )}
              >
                {initials}
              </div>
            )}

            {/* Overlay upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
              title="Changer la photo"
            >
              <Camera className="h-6 w-6 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-lg truncate">{name}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {ROLE_LABELS[user?.globalRole ?? ''] ?? user?.globalRole}
            </span>

            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                <Camera className="h-3.5 w-3.5" />
                {uploadMutation.isPending ? 'Envoi…' : 'Changer'}
              </Button>

              {user?.avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </Button>
              )}
            </div>

            {uploadMutation.isError && (
              <p className="text-xs text-danger mt-1">{(uploadMutation.error as Error).message}</p>
            )}
          </div>
        </div>

        {/* Palette couleurs — uniquement si pas de photo uploadée */}
        {!user?.avatarUrl && (
          <div className="space-y-2">
            <Label className="text-xs">Couleur de l'avatar</Label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => handleColorChange(c.value)}
                  title={c.label}
                  className={cn(
                    'h-7 w-7 rounded-full transition-all',
                    c.bg,
                    avatarColor === c.value
                      ? 'ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Formulaire identité */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-medium text-sm">Informations personnelles</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Prénom</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jean"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nom</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Dupont"
              onKeyDown={(e) => e.key === 'Enter' && mutation.mutate()}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input value={user?.email ?? ''} disabled className="text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">L'email ne peut pas être modifié ici.</p>
        </div>

        {mutation.isError && (
          <p className="text-sm text-danger">{(mutation.error as Error).message}</p>
        )}

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className={cn('transition-all', saved && 'bg-success hover:bg-success')}
        >
          {mutation.isPending ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}
