'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cabinetApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const schema = z.object({
  name: z.string().min(2, '2 caractères minimum'),
})

type FormData = z.infer<typeof schema>

export default function OnboardingPage() {
  const router = useRouter()
  const { token, hydrate, setCabinet } = useAuthStore()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    if (!token) {
      router.push('/login')
      return
    }
    try {
      const { data: result } = await cabinetApi.create(data.name, token)
      setCabinet({ id: result.cabinet.id, name: result.cabinet.name })
      router.push('/dashboard')
    } catch (err) {
      setError('root', {
        message: err instanceof ApiError ? err.message : 'Une erreur est survenue',
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">CGP Platform</h1>
          <p className="text-sm text-muted-foreground mt-1">Bienvenue ! Configurons votre cabinet.</p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-8">
          <h2 className="text-xl font-semibold mb-2">Créer votre cabinet</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Donnez un nom à votre cabinet. Vous pourrez le modifier plus tard dans les paramètres.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom du cabinet</Label>
              <Input
                id="name"
                placeholder="Cabinet Dupont & Associés"
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {errors.root && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {errors.root.message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Création…' : 'Créer mon cabinet'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
