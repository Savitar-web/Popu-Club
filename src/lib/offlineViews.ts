const KEY = 'pending_chapter_views'

type Pending = Record<string, number> // chapterId → cantidad

function readQueue(): Pending {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function writeQueue(q: Pending) {
  localStorage.setItem(KEY, JSON.stringify(q))
}

/** Llamar cada vez que alguien abre / lee un capítulo */
export function trackChapterView(chapterId: string) {
  const q = readQueue()
  q[chapterId] = (q[chapterId] || 0) + 1
  writeQueue(q)
  // Intento inmediato si hay red
  flushPendingViews()
}

/** Enviar cola a Supabase y vaciar lo enviado */
export async function flushPendingViews() {
  if (!navigator.onLine) return
  const q = readQueue()
  const entries = Object.entries(q)
  if (entries.length === 0) return

  // Importa tu cliente supabase donde corresponda
  const { supabase } = await import('./supabase')
  if (!supabase) return

  for (const [chapterId, count] of entries) {
    if (count <= 0) continue
    // RPC atómica (recomendado) o update manual
    const { error } = await supabase.rpc('add_chapter_views', {
      p_chapter_id: chapterId,
      p_count: count,
    })
    if (!error) {
      delete q[chapterId]
    }
  }
  writeQueue(q)
}

// Auto-flush al volver internet y al arrancar
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingViews()
  })
}