self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'CGP Platform', body: event.data.text() }
  }

  const { title, body, url, badge } = payload

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title || 'CGP Platform', {
        body: body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: url || '/' },
      }),
      // Pastille sur l'icône de l'app
      navigator.setAppBadge
        ? navigator.setAppBadge(badge || 1)
        : Promise.resolve(),
    ])
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  // Effacer la pastille quand l'utilisateur clique
  if (navigator.clearAppBadge) navigator.clearAppBadge()

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
