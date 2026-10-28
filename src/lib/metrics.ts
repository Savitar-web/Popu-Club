export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dayRange(days: number, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - days + 1)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start)
    date.setDate(date.getDate() + index)
    return { day: dayKey(date), views: 0, likes: 0, comments: 0 }
  })
}

export function moveItem<T extends { id: string }>(items: T[], id: string, targetId: string): T[] {
  const next = [...items]
  const from = next.findIndex((item) => item.id === id)
  const to = next.findIndex((item) => item.id === targetId)
  if (from < 0 || to < 0 || from === to) return next
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
