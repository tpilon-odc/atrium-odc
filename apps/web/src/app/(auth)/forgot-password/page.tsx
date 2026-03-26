'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
  email: z.string().email('Email invalide'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    // On confirme toujours pour ne pas révéler si l'email existe
    setSent(true)
  }

  if (sent) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center space-y-4">
        <div className="text-4xl">📬</div>
        <h2 className="text-xl font-semibold">Vérifiez votre boîte mail</h2>
        <p className="text-sm text-muted-foreground">
          Si un compte existe pour cet email, vous recevrez un lien pour réinitialiser votre mot de passe.
        </p>
        <Link href="/login" className="block text-sm text-primary hover:underline font-medium">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-8">
      <h2 className="text-xl font-semibold mb-2">Mot de passe oublié</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Entrez votre email pour recevoir un lien de réinitialisation.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Envoi…' : 'Envoyer le lien'}
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
