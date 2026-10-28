import { supabase } from './supabase'

const KEY = 'popu_pending_view_events'
type ViewEvent = { id: string; chapter_id: string; user_id: string | null; created_at: string }
let running: Promise<void> | null = null

function readQueue(): ViewEvent[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

async function locked<T>(work: () => Promise<T>) {
  return navigator.locks ? navigator.locks.request('popu-view-queue', work) : work()
}

export async function trackChapterView(chapterId: string, userId: string | null = null) {
  await locked(async () => {
    const queue = readQueue()
    queue.push({ id: crypto.randomUUID(), chapter_id: chapterId, user_id: userId, created_at: new Date().toISOString() })
    try { localStorage.setItem(KEY, JSON.stringify(queue)) } catch { /* storage unavailable */ }
  })
  void flushPendingViews()
}

/** UUIDs make retries idempotent, even if a successful response was lost. */
export function flushPendingViews(): Promise<void> {
  if (running) return running
  running = locked(async () => {
    if (!navigator.onLine || !supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    for (const event of readQueue()) {
      if (event.user_id && event.user_id !== session?.user.id) continue
      const { error } = await supabase.from('chapter_views').insert(event)
      if (error && error.code !== '23505') break
      const rest = readQueue().filter((item) => item.id !== event.id)
      localStorage.setItem(KEY, JSON.stringify(rest))
    }
    // Preserve and send any counters created by earlier app versions.
    let legacy: Record<string, number> = {}
    try { legacy = JSON.parse(localStorage.getItem('pending_chapter_views') || '{}') } catch { return }
    for (const [id, count] of Object.entries(legacy)) {
      if (count <= 0) continue
      const { error } = await supabase.rpc('add_chapter_views', { p_chapter_id: id, p_count: count })
      if (error) break
      delete legacy[id]
      localStorage.setItem('pending_chapter_views', JSON.stringify(legacy))
    }
  }).catch((error) => { console.warn('Vistas pendientes:', error) }).finally(() => { running = null })
  return running
}

window.addEventListener('online', () => { void flushPendingViews() })
