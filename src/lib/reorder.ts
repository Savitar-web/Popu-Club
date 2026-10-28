import { supabase } from './supabase'

/** Two phases avoid unique (chapter_id, page_number) collisions when swapping pages. */
export async function persistOrder(table: string, field: string, before: any[], after: any[]) {
  const changed = after.filter((item) => before.find((old) => old.id === item.id)?.[field] !== item[field])
  if (!changed.length) return
  const update = async (id: string, value: number) => {
    const { error } = await supabase.from(table).update({ [field]: value }).eq('id', id).select('id').single()
    if (error) throw error
  }
  const base = Math.max(0, ...before.map((item) => Number(item[field]) || 0), ...after.map((item) => Number(item[field]) || 0)) + 1
  async function stage() {
    for (let i = 0; i < changed.length; i++) await update(changed[i].id, base + i)
  }
  try {
    if (field === 'page_number') await stage()
    for (const item of changed) await update(item.id, item[field])
  } catch (error) {
    try {
      if (field === 'page_number') await stage()
      for (const item of changed) await update(item.id, before.find((old) => old.id === item.id)[field])
    } catch {
      throw new Error('La conexión se interrumpió. Revisa el orden guardado antes de volver a mover elementos.')
    }
    throw error
  }
}
