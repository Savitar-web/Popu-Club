import { supabase } from './supabase'

export type NotificationType = 'new_chapter' | 'new_comic' | 'comment_reply' | 'system'

export type AppNotification = {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  image_url: string | null
  link: string | null
  meta: Record<string, unknown>
  read: boolean
  created_at: string
}

/** Plantillas que el admin puede editar (site_settings.notification_templates) */
export async function getNotificationTemplates(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'notification_templates')
    .maybeSingle()
  return (data?.value as Record<string, string>) || {}
}

export async function saveNotificationTemplates(templates: Record<string, string>) {
  if (!supabase) return
  await supabase.from('site_settings').upsert({
    key: 'notification_templates',
    value: templates,
  })
}

/**
 * Nuevo arco creado → avisa a todos.
 * imageUrl = portada del arco
 * link = /comic/:id
 */
export async function notifyNewComic(opts: {
  comicId: string
  title: string
  imageUrl?: string | null
  customBody?: string
}) {
  if (!supabase) return 0
  const templates = await getNotificationTemplates()
  const title = templates.new_comic || '¡Nuevo arco en Popu-Club!'
  const body = opts.customBody || `Ya puedes explorar «${opts.title}».`
  const { data, error } = await supabase.rpc('notify_all_users', {
    p_type: 'new_comic',
    p_title: title,
    p_body: body,
    p_image_url: opts.imageUrl || null,
    p_link: `/comic/${opts.comicId}`,
    p_meta: { comic_id: opts.comicId },
  })
  if (error) {
    console.warn('notifyNewComic', error.message)
    return 0
  }
  return (data as number) || 0
}

/**
 * Capítulo publicado (status published) → avisa a todos.
 * Solo al publicar / crear como published, NO al editar título sin publicar.
 */
export async function notifyNewChapter(opts: {
  comicId: string
  chapterId: string
  comicTitle: string
  chapterTitle: string
  chapterNumber: number | string
  imageUrl?: string | null
  customBody?: string
}) {
  if (!supabase) return 0
  const templates = await getNotificationTemplates()
  const title = templates.new_chapter || '¡Nuevo capítulo disponible!'
  const body =
    opts.customBody ||
    `${opts.comicTitle} · #${opts.chapterNumber} «${opts.chapterTitle}»`
  const { data, error } = await supabase.rpc('notify_all_users', {
    p_type: 'new_chapter',
    p_title: title,
    p_body: body,
    p_image_url: opts.imageUrl || null,
    p_link: `/comic/${opts.comicId}/chapter/${opts.chapterId}`,
    p_meta: {
      comic_id: opts.comicId,
      chapter_id: opts.chapterId,
    },
  })
  if (error) {
    console.warn('notifyNewChapter', error.message)
    return 0
  }
  return (data as number) || 0
}

/** Respuesta a comentario → solo al autor del comentario padre */
export async function notifyCommentReply(opts: {
  targetUserId: string
  fromUsername: string
  preview: string
  chapterId: string
  comicId: string
}) {
  if (!supabase) return
  const templates = await getNotificationTemplates()
  const title = templates.comment_reply || 'Te respondieron un comentario'
  const body = `${opts.fromUsername}: ${opts.preview.slice(0, 120)}`
  const { error } = await supabase.rpc('notify_user', {
    p_user_id: opts.targetUserId,
    p_type: 'comment_reply',
    p_title: title,
    p_body: body,
    p_image_url: null,
    p_link: `/comic/${opts.comicId}/chapter/${opts.chapterId}#comentarios`,
    p_meta: { chapter_id: opts.chapterId },
  })
  if (error) console.warn('notifyCommentReply', error.message)
}

export async function fetchMyNotifications(limit = 40): Promise<AppNotification[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn(error.message)
    return []
  }
  return (data as AppNotification[]) || []
}

export async function markNotificationRead(id: string) {
  if (!supabase) return
  await supabase.from('notifications').update({ read: true }).eq('id', id)
}

export async function markAllNotificationsRead() {
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
}

export async function unreadCount(): Promise<number> {
  if (!supabase) return 0
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)
  return count || 0
}

/**
 * Capacitor / Electron (más adelante):
 * - Web: lees de esta tabla + badge en ProfileButton
 * - App nativa: un Edge Function o cron lee notificaciones nuevas y envía
 *   push con FCM / APNs usando title, body, image_url.
 * Guardamos image_url y redacción del admin para reutilizar el mismo payload.
 */
