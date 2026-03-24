import { create } from 'zustand'

type ConsentState = 'pending' | 'accepted' | 'refused'

interface CookieConsentStore {
  state: ConsentState
  hydrated: boolean
  hydrate: () => void
  accept: () => void
  refuse: () => void
}

export const useCookieConsent = create<CookieConsentStore>((set) => ({
  state: 'pending',
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('cgp_cookie_consent')
    if (stored) {
      try {
        const { accepted } = JSON.parse(stored)
        set({ state: accepted ? 'accepted' : 'refused', hydrated: true })
        return
      } catch { /* ignore */ }
    }
    set({ hydrated: true })
  },

  accept: () => {
    localStorage.setItem('cgp_cookie_consent', JSON.stringify({ accepted: true }))
    set({ state: 'accepted' })
  },

  refuse: () => {
    localStorage.setItem('cgp_cookie_consent', JSON.stringify({ accepted: false }))
    set({ state: 'refused' })
  },
}))
