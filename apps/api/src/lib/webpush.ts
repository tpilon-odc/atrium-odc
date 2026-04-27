import webpush from 'web-push'
import { prisma } from './prisma'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
  title: string
  body: string
  url?: string
  badge?: number
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const [subscriptions, unreadCount] = await Promise.all([
    prisma.pushSubscription.findMany({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ])

  const fullPayload = { ...payload, badge: unreadCount || 1 }

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(fullPayload)
      )
    )
  )

  // Supprimer les subscriptions expirées (410 Gone)
  const expiredEndpoints: string[] = []
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number }
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expiredEndpoints.push(subscriptions[i].endpoint)
      }
    }
  })

  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: expiredEndpoints } },
    })
  }
}
