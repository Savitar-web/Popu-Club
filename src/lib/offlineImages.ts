/** Guarda las imágenes de las páginas en IndexedDB para leer sin internet. */
const DB = 'popu-images'
const STORE = 'blobs'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveImages(urls: (string | null | undefined)[]) {
  const unique = [...new Set(urls.filter((u): u is string => !!u && u.startsWith('http')))]
  if (!unique.length) return
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return
  }
  for (const url of unique) {
    try {
      const exists = await new Promise<boolean>((resolve) => {
        const tx = db.transaction(STORE, 'readonly')
        const r = tx.objectStore(STORE).getKey(url)
        r.onsuccess = () => resolve(!!r.result)
        r.onerror = () => resolve(false)
      })
      if (exists) continue
      const res = await fetch(url)
      if (!res.ok) continue
      const blob = await res.blob()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(blob, url)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch {
      /* sin red o cuota */
    }
  }
}

export async function localImage(url: string | null | undefined): Promise<string> {
  if (!url) return ''
  try {
    const db = await openDb()
    const blob = await new Promise<Blob | undefined>((resolve) => {
      const tx = db.transaction(STORE, 'readonly')
      const r = tx.objectStore(STORE).get(url)
      r.onsuccess = () => resolve(r.result as Blob | undefined)
      r.onerror = () => resolve(undefined)
    })
    if (blob) return URL.createObjectURL(blob)
  } catch {
    /* ignore */
  }
  return url
}

export async function withTimeout<T>(promise: Promise<T>, ms = 7000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}
