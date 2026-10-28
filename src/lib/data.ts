import { supabase } from './supabase'

/** Read every page instead of silently truncating at the API row limit. */
export async function readAll<T>(table: string, columns: string, filter?: (query: any) => any, order = 'id'): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from(table).select(columns).order(order, { ascending: true }).range(offset, offset + 499)
    if (filter) query = filter(query)
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 500) return rows
  }
}

export async function chapterCounts(ids?: string[]) {
  if (ids && !ids.length) return { views: {}, likes: {}, comments: {} }
  const filter = ids ? (q: any) => q.in('chapter_id', ids) : undefined
  const results = await Promise.all(['chapter_views', 'likes', 'comments'].map(async (table) => {
    const rows = await readAll<{ chapter_id: string }>(table, 'id, chapter_id', filter)
    const counts: Record<string, number> = {}
    rows.forEach((row) => { counts[row.chapter_id] = (counts[row.chapter_id] || 0) + 1 })
    return counts
  }))
  return { views: results[0], likes: results[1], comments: results[2] }
}
