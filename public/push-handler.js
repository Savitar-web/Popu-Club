/* Lo carga el service worker. Muestra el aviso aunque la pestaña esté cerrada. */
self.addEventListener('push', (event) => {
  let data = { title: 'Popu-Club', body: '', link: '/home', icon: '/pwa-192.png' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    /* texto plano */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Popu-Club', {
      body: data.body || '',
      icon: data.icon || '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: data.link || '/home' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
