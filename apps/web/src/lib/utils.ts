import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Ajoute le token JWT en query param sur les URLs de fichiers API
// Nécessaire car <img>, <a>, window.open ne peuvent pas envoyer de header Authorization
export function withToken(url: string | null | undefined, token: string | null | undefined): string | null {
  if (!url || !token) return url ?? null
  if (!url.includes('/api/v1/files/')) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}token=${token}`
}
