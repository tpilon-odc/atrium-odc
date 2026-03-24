'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { consentApi, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'

const CGU_VERSION = process.env.NEXT_PUBLIC_CGU_VERSION ?? '1.0'

export default function ConsentPage() {
  const { token } = useAuthStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    if (!token) {
      router.push('/login')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await consentApi.accept(CGU_VERSION, token)
      router.push('/dashboard')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Une erreur est survenue")
      setLoading(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-base">Conditions d&apos;utilisation</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Version {CGU_VERSION}</p>
        </div>
      </div>

      {/* Résumé des points clés */}
      <div className="space-y-2.5 text-sm">
        {[
          "Vos données sont hébergées en France et ne sont jamais revendues.",
          "Vous pouvez demander l'accès ou l'effacement de vos données à tout moment.",
          "Nous utilisons uniquement des cookies essentiels au fonctionnement.",
          "Vos documents sont stockés chiffrés et accessibles uniquement par votre cabinet.",
        ].map((point) => (
          <div key={point} className="flex items-start gap-2.5 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>{point}</span>
          </div>
        ))}
      </div>

      {/* Liens légaux */}
      <div className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p>En cliquant sur &quot;Accepter&quot;, vous acceptez nos :</p>
        <div className="flex gap-3 mt-1.5">
          <Link href="/legal/terms" target="_blank" className="text-primary hover:underline">
            Conditions générales d&apos;utilisation
          </Link>
          <span>·</span>
          <Link href="/legal/privacy" target="_blank" className="text-primary hover:underline">
            Politique de confidentialité
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* CTA */}
      <div className="flex flex-col gap-2 pt-1">
        <Button onClick={handleAccept} disabled={loading} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Accepter et continuer
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Vous ne pouvez pas utiliser la plateforme sans accepter les CGU.
        </p>
      </div>
    </div>
  )
}
