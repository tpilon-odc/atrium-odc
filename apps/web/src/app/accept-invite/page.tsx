'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { authApi, cabinetApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  password: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm'],
})

type FormData = z.infer<typeof schema>

export default function AcceptInvitePage() {
  const router = useRouter()
  const { setAuth, setCabinet } = useAuthStore()
  const [status, setStatus] = useState<'verifying' | 'set-password' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function redirectAfterLogin(email: string, password: string) {
    try {
      const { data: result } = await authApi.login(email, password)
      setAuth(result.session.access_token, result.user)
      try {
        const { data: cabinetData } = await cabinetApi.getMe(result.session.access_token)
        setCabinet({ id: cabinetData.cabinet.id, name: cabinetData.cabinet.name })
        router.push('/dashboard')
      } catch {
        router.push('/onboarding')
      }
    } catch {
      setErrorMsg('Connexion impossible. Réessayez depuis la page de login.')
      setStatus('error')
    }
  }

  useEffect(() => {
    const supabase = createClient()
    const hash = window.location.hash.substring(1)
    const hashParams = new URLSearchParams(hash)
    const queryParams = new URLSearchParams(window.location.search)

    const accessToken = hashParams.get('access_token') ?? queryParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token') ?? queryParams.get('refresh_token')
    const type = hashParams.get('type') ?? queryParams.get('type')
    const tokenHash = queryParams.get('token_hash')
    const errorCode = hashParams.get('error_code') ?? queryParams.get('error_code')
    const errorDesc = hashParams.get('error_description') ?? queryParams.get('error_description')

    if (errorCode) {
      setErrorMsg(errorDesc?.replace(/\+/g, ' ') ?? 'Lien invalide ou expiré. Demandez une nouvelle invitation.')
      setStatus('error')
      return
    }

    if (tokenHash && (type === 'invite' || type === 'magiclink')) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'invite' | 'magiclink' }).then(async ({ error }) => {
        if (error) {
          setErrorMsg('Lien expiré ou déjà utilisé. Demandez une nouvelle invitation.')
          setStatus('error')
        } else if (type === 'invite') {
          setStatus('set-password')
        } else {
          // magiclink : session active, redirige directement
          const { data: { user } } = await supabase.auth.getUser()
          if (user?.email) await redirectAfterLogin(user.email, '')
          else { setErrorMsg('Session introuvable.'); setStatus('error') }
        }
      })
    } else if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(async ({ data: { session }, error }) => {
        if (error || !session) {
          setErrorMsg('Session invalide. Demandez une nouvelle invitation.')
          setStatus('error')
        } else {
          // Invite ou magiclink : l'utilisateur n'a pas encore de mot de passe, il doit en définir un
          setStatus('set-password')
        }
      })
    } else {
      setErrorMsg('Lien d\'invitation invalide ou expiré.')
      setStatus('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      setErrorMsg('Impossible de définir le mot de passe : ' + error.message)
      setStatus('error')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      setErrorMsg('Session introuvable.')
      setStatus('error')
      return
    }
    await redirectAfterLogin(user.email, data.password)
  }

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Vérification du lien…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full space-y-4">
          <h2 className="text-xl font-semibold">Erreur</h2>
          <p className="text-sm text-destructive">{errorMsg}</p>
          <Button variant="outline" onClick={() => router.push('/login')}>Retour à la connexion</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-2">Bienvenue !</h2>
        <p className="text-sm text-muted-foreground mb-6">Définissez votre mot de passe pour accéder à la plateforme.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmer le mot de passe</Label>
            <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : 'Accéder à la plateforme'}
          </Button>
        </form>
      </div>
    </div>
  )
}
