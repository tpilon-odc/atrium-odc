'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X, Cookie, Shield } from 'lucide-react'
import { useCookieConsent } from '@/stores/cookie-consent'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-6 md:left-auto md:right-6 md:translate-x-0 z-[9999] bg-foreground text-background text-sm px-4 py-3 rounded-lg shadow-lg max-w-sm text-center md:text-left animate-in fade-in slide-in-from-bottom-2"
    >
      {message}
    </div>
  )
}

// ── Modal détail cookies ───────────────────────────────────────────────────────

function CookieDetailModal({ onClose }: { onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Détail des cookies utilisés"
      className="fixed inset-0 z-[9998] flex items-end md:items-center justify-center bg-foreground/40 p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Cookies utilisés</h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fermer"
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenu */}
        <div className="overflow-y-auto px-5 py-4 space-y-5 text-sm">
          <p className="text-muted-foreground">
            Cette plateforme utilise uniquement des cookies strictement nécessaires à son fonctionnement.
            Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé.
          </p>

          {/* Tableau cookies */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Nom</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Finalité</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { name: 'sb-access-token', purpose: 'Authentification Supabase', duration: 'Session' },
                  { name: 'sb-refresh-token', purpose: 'Renouvellement de session', duration: '30 jours' },
                  { name: 'cgp_cookie_consent', purpose: 'Mémorisation de votre choix', duration: '1 an' },
                ].map((row) => (
                  <tr key={row.name} className="bg-card">
                    <td className="px-3 py-2.5 font-mono text-[11px] text-foreground">{row.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.purpose}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{row.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Les cookies d&apos;authentification sont strictement nécessaires au fonctionnement du service.
            Ils sont légalement autorisés sans consentement préalable (art. 82 de la loi Informatique et Libertés).
          </p>

          <div className="pt-1">
            <Link
              href="/legal/privacy"
              className="text-primary text-xs hover:underline"
              onClick={onClose}
            >
              Consulter notre politique de confidentialité →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Banner ────────────────────────────────────────────────────────────────────

export function CookieBanner() {
  const { state, hydrated, hydrate, accept, refuse } = useCookieConsent()
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { hydrate() }, [hydrate])

  if (!hydrated || state !== 'pending') return (
    <>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {showModal && <CookieDetailModal onClose={() => setShowModal(false)} />}
    </>
  )

  function handleRefuse() {
    refuse()
    setToast('Seuls les cookies essentiels sont actifs. La plateforme reste pleinement fonctionnelle.')
  }

  return (
    <>
      {/* Bandeau */}
      <div
        role="region"
        aria-label="Bandeau de consentement aux cookies"
        className={cn(
          'fixed bottom-0 inset-x-0 z-[9997] bg-card border-t border-border shadow-lg',
          'md:bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:rounded-xl md:border md:max-w-2xl md:w-[calc(100%-2rem)]'
        )}
      >
        <div className="px-4 py-4 md:px-5 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Cookie className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nous utilisons des cookies essentiels pour l&apos;authentification et le bon fonctionnement du service.{' '}
              <button
                onClick={() => setShowModal(true)}
                className="text-primary hover:underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                En savoir plus
              </button>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefuse}
              className="flex-1 md:flex-none"
            >
              Refuser
            </Button>
            <Button
              size="sm"
              onClick={accept}
              className="flex-1 md:flex-none"
            >
              Accepter
            </Button>
          </div>
        </div>
      </div>

      {showModal && <CookieDetailModal onClose={() => setShowModal(false)} />}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  )
}
