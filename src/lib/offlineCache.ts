/** Caché local de datos (arcos, capítulos, comentarios, páginas).
 *  Sobrevive al cierre de la app y funciona sin internet. */
const PREFIX = 'popu_off_'
const MAX_AGE = 1000 * 60 * 60 * 24 * 30

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: T; exp?: number }
    if (parsed.exp && Date.now() > parsed.exp) return null
    return parsed.data
  } catch {
    return null
  }
}

export function cacheSet(key: string, data: unknown) {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ data, exp: Date.now() + MAX_AGE })
    )
  } catch {
    /* cuota llena: ignorar */
  }
}

/** Precalienta la caché de imágenes del service worker / navegador. */
export function warmImages(urls: (string | null | undefined)[]) {
  for (const url of urls) {
    if (!url || !url.startsWith('http')) continue
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    } catch {
      /* ignore */
    }
  }
}
