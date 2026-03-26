'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi, cabinetApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionExpired = searchParams.get('reason') === 'session_expired'
  const { setAuth, setCabinet } = useAuthStore()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      const { data: result } = await authApi.login(data.email, data.password)
      setAuth(result.session.access_token, result.user)

      // Les rôles plateforme n'ont pas de cabinet
      const noCabinet = ['chamber', 'regulator', 'platform_admin'].includes(result.user.globalRole)
      if (noCabinet) {
        router.push('/dashboard')
        return
      }

      // Récupère le cabinet courant
      try {
        const { data: cabinetData } = await cabinetApi.getMe(result.session.access_token)
        setCabinet({ id: cabinetData.cabinet.id, name: cabinetData.cabinet.name })
        router.push('/dashboard')
      } catch {
        // Pas de cabinet → onboarding
        router.push('/onboarding')
      }
    } catch (err) {
      setError('root', {
        message: err instanceof ApiError ? err.message : 'Une erreur est survenue',
      })
    }
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-8">
      <h2 className="text-xl font-semibold mb-6">Connexion</h2>

      {sessionExpired && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-md bg-warning-subtle text-warning-subtle-foreground text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Votre session a expiré. Veuillez vous reconnecter.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {errors.root && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {errors.root.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>

      <p className="mt-4 text-sm text-center text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="text-primary hover:underline font-medium">
          Créer un compte
        </Link>
      </p>
    </div>
  )
}
