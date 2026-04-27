'use client'

import { useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const STORAGE_KEY = 'cgp_push_subscribed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function swReady(timeoutMs = 10000): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('SW ready timeout')), timeoutMs)
    ),
  ]) as Promise<ServiceWorkerRegistration>
}

async function subscribeUser(token: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  if (!VAPID_PUBLIC_KEY) return

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

  const registration = await swReady()
  const existing = await registration.pushManager.getSubscription()

  if (existing && localStorage.getItem(STORAGE_KEY) === existing.endpoint) return

  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
  })

  const { endpoint, keys } = subscription.toJSON() as {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  const res = await fetch(`${API_URL}/api/v1/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ endpoint, keys }),
  })

  if (res.ok) {
    localStorage.setItem(STORAGE_KEY, endpoint)
  }
}

export function usePushNotifications(token: string | null) {
  useEffect(() => {
    if (!token) return
    const t = setTimeout(() => {
      subscribeUser(token).catch(console.error)
    }, 3000)
    return () => clearTimeout(t)
  }, [token])
}
