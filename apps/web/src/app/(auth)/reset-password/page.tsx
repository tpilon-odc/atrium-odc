'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'implicit' } }
  )
}

const schema = z.object({
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm'],
})

type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState<'verifying' | 'ready' | 'done' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
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
      setErrorMsg(errorDesc?.replace(/\+/g, ' ') ?? 'Lien invalide ou expiré.')
      setStatus('error')
      return
    }

    if (tokenHash && type === 'recovery') {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(({ error }) => {
        if (error) {
          setErrorMsg('Lien expiré ou déjà utilisé. Demandez un nouveau lien.')
          setStatus('error')
        } else {
          setStatus('ready')
        }
      })
    } else if (accessToken && refreshToken && type === 'recovery') {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        if (error) {
          setErrorMsg('Session invalide. Demandez un nouveau lien.')
          setStatus('error')
        } else {
          setStatus('ready')
        }
      })
    } else {
      setErrorMsg('Lien invalide ou expiré. Demandez un nouveau lien.')
      setStatus('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      setErrorMsg(error.message)
      return
    }
    setStatus('done')
    setTimeout(() => router.push('/login'), 2500)
  }

  if (status === 'verifying') {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">Vérification du lien…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Lien invalide</h2>
        <p className="text-sm text-destructive">{errorMsg}</p>
        <Link href="/forgot-password" className="block text-sm text-primary hover:underline font-medium">
          Demander un nouveau lien
        </Link>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-semibold">Mot de passe modifié</h2>
        <p className="text-sm text-muted-foreground">Vous allez être redirigé vers la connexion…</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-8">
      <h2 className="text-xl font-semibold mb-2">Nouveau mot de passe</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Choisissez un mot de passe d'au moins 8 caractères.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmer</Label>
          <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>

        {errorMsg && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{errorMsg}</p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </Button>
      </form>

      <p className="mt-4 text-sm text-center text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline font-medium">
          Retour à la connexion
        </Link>
      </p>
    </div>
  )
}
