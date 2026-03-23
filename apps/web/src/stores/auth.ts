import { create } from 'zustand'

type User = {
  id: string
  email: string
  globalRole: string
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
}

type Cabinet = {
  id: string
  name: string
}

interface AuthState {
  token: string | null
  user: User | null
  cabinet: Cabinet | null
  setAuth: (token: string, user: User) => void
  setCabinet: (cabinet: Cabinet) => void
  logout: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  cabinet: null,

  setAuth: (token, user) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, user })
  },

  setCabinet: (cabinet) => {
    localStorage.setItem('cabinet', JSON.stringify(cabinet))
    set({ cabinet })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    localStorage.removeItem('cabinet')
    set({ token: null, user: null, cabinet: null })
  },

  hydrate: () => {
    const token = localStorage.getItem('access_token')
    const userRaw = localStorage.getItem('user')
    const cabinetRaw = localStorage.getItem('cabinet')
    set({
      token,
      user: userRaw ? (JSON.parse(userRaw) as User) : null,
      cabinet: cabinetRaw ? (JSON.parse(cabinetRaw) as Cabinet) : null,
    })
  },
}))
