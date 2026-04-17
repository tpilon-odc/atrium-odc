'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Platform = 'android' | 'ios' | null

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return null
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)
  const isInStandaloneMode =
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches

  if (isInStandaloneMode) return null
  if (isIOS) return 'ios'
  if (isAndroid) return 'android'
  return null
}

const STORAGE_KEY = 'cgp_install_dismissed'
const DISMISS_DELAY_DAYS = 30

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const ts = parseInt(raw, 10)
    const days = (Date.now() - ts) / (1000 * 60 * 60 * 24)
    return days < DISMISS_DELAY_DAYS
  } catch {
    return false
  }
}

function dismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    // ignore
  }
}

export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isDismissed()) return

    const p = detectPlatform()
    if (!p) return

    if (p === 'android') {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setPlatform('android')
        setVisible(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }

    if (p === 'ios') {
      // Délai court pour ne pas bloquer le rendu initial
      const t = setTimeout(() => {
        setPlatform('ios')
        setVisible(true)
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [])

  function handleClose() {
    dismiss()
    setVisible(false)
  }

  async function handleInstallAndroid() {
    if (!deferredPrompt) return
    const promptEvent = deferredPrompt as BeforeInstallPromptEvent
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') {
      dismiss()
    }
    setVisible(false)
    setDeferredPrompt(null)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Installer l'application"
      className={cn(
        'fixed bottom-0 inset-x-0 z-[9996] bg-card border-t border-border shadow-xl',
        'md:bottom-4 md:inset-x-auto md:right-4 md:left-auto md:rounded-xl md:border md:w-80',
        'animate-in slide-in-from-bottom-2 duration-300'
      )}
    >
      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-sm">Installer l&apos;application</span>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {platform === 'android' && (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Accédez rapidement à la plateforme depuis votre écran d&apos;accueil.
            </p>
            <Button size="sm" onClick={handleInstallAndroid} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Installer
            </Button>
          </>
        )}

        {platform === 'ios' && (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ajoutez la plateforme à votre écran d&apos;accueil pour un accès rapide.
            </p>
            <ol className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium shrink-0">1</span>
                <span>Appuyez sur <Share className="h-3.5 w-3.5 inline-block mx-0.5 text-primary" /> <strong>Partager</strong> dans Safari</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium shrink-0">2</span>
                <span>Puis <Plus className="h-3.5 w-3.5 inline-block mx-0.5 text-primary" /> <strong>Sur l&apos;écran d&apos;accueil</strong></span>
              </li>
            </ol>
            <Button size="sm" variant="outline" onClick={handleClose} className="w-full">
              Compris
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// Typage de l'event non standard Chrome
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
