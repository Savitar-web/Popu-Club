import { useEffect, useState, FormEvent, DragEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import { supabase, isSupabaseConfigured, isAdmin, getMyProfile } from '../lib/supabase'

function sanitizeFileName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'file'
  )
}

type Comic = {
  id: string
  title: string
  description: string | null
  cover_url: string | null
  banner_url?: string | null
  genre: string | null
  status: string
  is_featured?: boolean
  is_finished?: boolean
  sort_order?: number
}
type Chapter = {
  id: string
  comic_id: string
  number: number
  title: string
  status: string
  published_at: string | null
  icon_url?: string | null
}
type PageRow = { id: string; image_url: string; page_number: number }
type SliderRow = { id: string; image_url: string; sort_order: number; is_active: boolean }
type CommentRow = {
  id: string
  content: string
  created_at: string
  chapter_id: string
  user_id: string
  is_disabled?: boolean
  profiles?: { username: string | null } | null
  chapters?: { title: string; number: number; comic_id: string; comics?: { title: string } | null } | null
}

export default function Admin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [tab, setTab] = useState<'comics' | 'chapters' | 'comments' | 'slider' | 'users' | 'stats'>('comics')
  const [comics, setComics] = useState<Comic[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [selectedComicId, setSelectedComicId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [accessLogs, setAccessLogs] = useState<any[]>([])
  const [stats, setStats] = useState<{ views: number; likes: number; comments: number }>({ views: 0, likes: 0, comments: 0 })
  const [comicStats, setComicStats] = useState<any[]>([])
  const [chapterStats, setChapterStats] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [modal, setModal] = useState<{ title: string; body: string; onConfirm?: () => void } | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('Drama')
  const [status, setStatus] = useState('draft')
  const [isFeatured, setIsFeatured] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)

  const [editChapterId, setEditChapterId] = useState<string | null>(null)
  const [chNumber, setChNumber] = useState<number | string>(1)
  const [chTitle, setChTitle] = useState('')
  const [chStatus, setChStatus] = useState('draft')
  const [chIconFile, setChIconFile] = useState<File | null>(null)
  const [chIconPreview, setChIconPreview] = useState<string | null>(null)
  const [pageFiles, setPageFiles] = useState<FileList | null>(null)
  const [pagePreviewNames, setPagePreviewNames] = useState<string[]>([])
  const [manageChapterId, setManageChapterId] = useState<string | null>(null)
  const [managePages, setManagePages] = useState<PageRow[]>([])
  const [addPageFiles, setAddPageFiles] = useState<FileList | null>(null)

  const [sliderEnabled, setSliderEnabled] = useState(true)
  const [slides, setSlides] = useState<SliderRow[]>([])
  const [slideFiles, setSlideFiles] = useState<FileList | null>(null)

  const [cSearch, setCSearch] = useState('')
  const [cFilterArc, setCFilterArc] = useState('all')
  const [cFilterChapter, setCFilterChapter] = useState('all')
  const [cFilterUser, setCFilterUser] = useState('all')
  const [selectedComment, setSelectedComment] = useState<CommentRow | null>(null)

  const [dragComicId, setDragComicId] = useState<string | null>(null)
  const [dragSlideId, setDragSlideId] = useState<string | null>(null)
  const [dragPageId, setDragPageId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      if (!isSupabaseConfigured || !supabase) {
        setError('Supabase no configurado')
        setLoading(false)
        return
      }
      if (!(await isAdmin())) {
        setError('restricted')
        setLoading(false)
        return
      }
      setAllowed(true)
      await loadComics()
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!allowed) return
    if (tab === 'comments') loadComments()
    if (tab === 'slider') loadSlider()
    if (tab === 'users') { loadUsers(); loadAccessLogs() }
    if (tab === 'stats') { loadAccessLogs(); loadStats() }
  }, [tab, allowed])

  const loadUsers = async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('username', { ascending: true })
      .limit(300)
    if (error) {
      setError('Usuarios: ' + error.message)
      console.warn(error)
    }
    setUsers(data || [])
  }

  const loadAccessLogs = async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('admin_access_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) console.warn('access log', error.message)
    setAccessLogs(data || [])
  }

  const loadStats = async () => {
    if (!supabase) return
    try {
      const [vRes, lRes, cRes] = await Promise.all([
        supabase.from('chapter_views').select('*', { count: 'exact', head: true }),
        supabase.from('likes').select('*', { count: 'exact', head: true }),
        supabase.from('comments').select('*', { count: 'exact', head: true }),
      ])
      setStats({
        views: vRes.count || 0,
        likes: lRes.count || 0,
        comments: cRes.count || 0,
      })
      // Por arco
      const { data: comicsList } = await supabase.from('comics').select('id, title').order('title')
      const cStats: any[] = []
      for (const c of comicsList || []) {
        const { data: chs } = await supabase.from('chapters').select('id').eq('comic_id', c.id)
        const ids = (chs || []).map((x: any) => x.id)
        let views = 0, likes = 0, comments = 0
        if (ids.length) {
          const [vr, lr, cr] = await Promise.all([
            supabase.from('chapter_views').select('*', { count: 'exact', head: true }).in('chapter_id', ids),
            supabase.from('likes').select('*', { count: 'exact', head: true }).in('chapter_id', ids),
            supabase.from('comments').select('*', { count: 'exact', head: true }).in('chapter_id', ids),
          ])
          views = vr.count || 0
          likes = lr.count || 0
          comments = cr.count || 0
        }
        cStats.push({ id: c.id, title: c.title, views, likes, comments, chapters: ids.length })
      }
      setComicStats(cStats)
      // Por capítulo (top 40)
      const { data: allCh } = await supabase
        .from('chapters')
        .select('id, title, number, comic_id, comics(title)')
        .order('created_at', { ascending: false })
        .limit(40)
      const chStats: any[] = []
      for (const ch of allCh || []) {
        const [vr, lr, cr] = await Promise.all([
          supabase.from('chapter_views').select('*', { count: 'exact', head: true }).eq('chapter_id', ch.id),
          supabase.from('likes').select('*', { count: 'exact', head: true }).eq('chapter_id', ch.id),
          supabase.from('comments').select('*', { count: 'exact', head: true }).eq('chapter_id', ch.id),
        ])
        chStats.push({
          id: ch.id,
          title: ch.title,
          number: ch.number,
          comic: (ch as any).comics?.title,
          views: vr.count || 0,
          likes: lr.count || 0,
          comments: cr.count || 0,
        })
      }
      setChapterStats(chStats)
    } catch (e) {
      console.warn(e)
    }
  }


  const banComments = (u: any, days: number | null) => {
    const label = days === null ? 'indefinido (hasta desactivar)' : `${days} día(s)`
    setModal({
      title: 'Amonestar comentarios',
      body: `¿Impedir que ${u.username || u.email} comente durante ${label}?`,
      onConfirm: async () => {
        if (!supabase) return
        const until = days === null
          ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString()
          : new Date(Date.now() + days * 86400000).toISOString()
        await supabase.from('profiles').update({
          comment_ban_until: until,
          warn_count: (u.warn_count || 0) + 1,
        }).eq('id', u.id)
        setMessage('Restricción de comentarios aplicada')
        setModal(null)
        await loadUsers()
      },
    })
  }

  const clearCommentBan = (u: any) => {
    setModal({
      title: 'Quitar amonestación',
      body: `¿Permitir de nuevo que ${u.username || u.email} comente?`,
      onConfirm: async () => {
        if (!supabase) return
        await supabase.from('profiles').update({ comment_ban_until: null }).eq('id', u.id)
        setMessage('Amonestación retirada')
        setModal(null)
        await loadUsers()
      },
    })
  }

  const banAccount = (u: any, days: number | null) => {
    setModal({
      title: 'Suspender cuenta',
      body: days === null
        ? `¿Suspender ${u.username || u.email} de forma prolongada?`
        : `¿Suspender ${u.username || u.email} durante ${days} día(s)?`,
      onConfirm: async () => {
        if (!supabase) return
        const until = days === null
          ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString()
          : new Date(Date.now() + days * 86400000).toISOString()
        await supabase.from('profiles').update({ banned_until: until }).eq('id', u.id)
        setMessage('Cuenta suspendida')
        setModal(null)
        await loadUsers()
      },
    })
  }

  const unbanAccount = (u: any) => {
    setModal({
      title: 'Reactivar cuenta',
      body: `¿Quitar la suspensión de ${u.username || u.email}?`,
      onConfirm: async () => {
        if (!supabase) return
        await supabase.from('profiles').update({ banned_until: null, comment_ban_until: null }).eq('id', u.id)
        setMessage('Cuenta reactivada')
        setModal(null)
        await loadUsers()
      },
    })
  }

  useEffect(() => {
    if (selectedComicId) loadChapters(selectedComicId)
  }, [selectedComicId])

  const loadComics = async () => {
    if (!supabase) return
    const { data, error: err } = await supabase
      .from('comics')
      .select('*')
      .order('sort_order', { ascending: true })
    if (err) setError(err.message)
    else setComics((data as Comic[]) || [])
  }

  const loadChapters = async (comicId: string) => {
    if (!supabase) return
    const { data } = await supabase
      .from('chapters')
      .select('*')
      .eq('comic_id', comicId)
      .order('number', { ascending: true })
    const list = (data as Chapter[]) || []
    setChapters(list)
    // Siguiente número sugerido (máximo + 1)
    if (!editChapterId && list.length > 0) {
      const max = Math.max(...list.map((c) => Number(c.number) || 0))
      setChNumber(Number.isFinite(max) ? max + 1 : 1)
    } else if (!editChapterId && list.length === 0) {
      setChNumber(1)
    }
  }

  const loadComments = async () => {
    if (!supabase) return
    const { data, error: err } = await supabase
      .from('comments')
      .select(
        `id, content, created_at, chapter_id, user_id, is_disabled,
         profiles(username),
         chapters(title, number, comic_id, comics(title))`
      )
      .order('created_at', { ascending: false })
      .limit(300)
    if (err) setError(err.message)
    else setComments((data as any) || [])
  }

  const loadSlider = async () => {
    if (!supabase) return
    const { data: settings } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'slider')
      .maybeSingle()
    setSliderEnabled(settings?.value?.enabled !== false)
    const { data } = await supabase
      .from('slider_images')
      .select('*')
      .order('sort_order', { ascending: true })
    setSlides((data as SliderRow[]) || [])
  }

  const loadChapterPages = async (chapterId: string) => {
    if (!supabase) return
    setManageChapterId(chapterId)
    const { data } = await supabase
      .from('pages')
      .select('id, image_url, page_number')
      .eq('chapter_id', chapterId)
      .order('page_number', { ascending: true })
    setManagePages((data as PageRow[]) || [])
  }

  const resetComicForm = () => {
    setEditId(null)
    setTitle('')
    setDescription('')
    setGenre('Drama')
    setStatus('draft')
    setIsFeatured(false)
    setIsFinished(false)
    setCoverFile(null)
    setCoverPreview(null)
    setBannerFile(null)
    setBannerPreview(null)
  }

  const resetChapterForm = () => {
    setEditChapterId(null)
    setChTitle('')
    setChStatus('draft')
    setChIconFile(null)
    setChIconPreview(null)
    setPageFiles(null)
    setPagePreviewNames([])
    if (chapters.length > 0) {
      const max = Math.max(...chapters.map((c) => Number(c.number) || 0))
      setChNumber(max + 1)
    } else setChNumber(1)
  }

  const saveComic = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setMessage('')
    setError('')
    const profile = await getMyProfile()
    let cover_url: string | null = null
    if (coverFile) {
      const path = `covers/${Date.now()}-${sanitizeFileName(coverFile.name)}`
      const { error: upErr } = await supabase.storage.from('comics').upload(path, coverFile, {
        upsert: true,
        contentType: coverFile.type || 'image/jpeg',
      })
      if (upErr) {
        setError('Error portada: ' + upErr.message)
        return
      }
      cover_url = supabase.storage.from('comics').getPublicUrl(path).data.publicUrl
    }
    let banner_url: string | null = null
    if (bannerFile) {
      const path = `banners/${Date.now()}-${sanitizeFileName(bannerFile.name)}`
      const { error: upErr } = await supabase.storage.from('comics').upload(path, bannerFile, {
        upsert: true,
        contentType: bannerFile.type || 'image/jpeg',
      })
      if (upErr) {
        setError('Error banner: ' + upErr.message)
        return
      }
      banner_url = supabase.storage.from('comics').getPublicUrl(path).data.publicUrl
    }
    const payload: any = {
      title,
      description,
      genre,
      status,
      is_featured: isFeatured,
      is_finished: isFinished,
      updated_at: new Date().toISOString(),
    }
    if (cover_url) payload.cover_url = cover_url
    if (banner_url) payload.banner_url = banner_url
    if (editId) {
      const { error: err } = await supabase.from('comics').update(payload).eq('id', editId)
      if (err) setError(err.message)
      else {
        setMessage('Arco actualizado')
        resetComicForm()
        await loadComics()
      }
    } else {
      payload.created_by = profile?.id
      payload.sort_order = comics.length
      const { error: err } = await supabase.from('comics').insert(payload)
      if (err) setError(err.message)
      else {
        setMessage('Arco creado')
        resetComicForm()
        await loadComics()
      }
    }
  }

  const startEdit = (c: Comic) => {
    setEditId(c.id)
    setTitle(c.title)
    setDescription(c.description || '')
    setGenre(c.genre || 'Drama')
    setStatus(c.status)
    setIsFeatured(!!c.is_featured)
    setIsFinished(!!c.is_finished)
    setCoverPreview(c.cover_url)
    setBannerPreview(c.banner_url || null)
    setTab('comics')
  }

  const startEditChapter = (ch: Chapter) => {
    setEditChapterId(ch.id)
    setChNumber(ch.number)
    setChTitle(ch.title)
    setChStatus(ch.status)
    setChIconPreview(ch.icon_url || null)
    setChIconFile(null)
    setPageFiles(null)
    setPagePreviewNames([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteComic = async (id: string) => {
    if (!supabase) return
    setModal({
      title: 'Eliminar arco',
      body: '¿Seguro que quieres eliminar este arco? Se borrarán también sus capítulos y páginas. Esta acción no se puede deshacer.',
      onConfirm: async () => {
        await supabase!.from('comics').delete().eq('id', id)
        setMessage('Arco eliminado')
        setModal(null)
        await loadComics()
      },
    })
  }

  const onComicDrop = async (targetId: string) => {
    if (!supabase || !dragComicId || dragComicId === targetId) return
    const list = [...comics]
    const from = list.findIndex((c) => c.id === dragComicId)
    const to = list.findIndex((c) => c.id === targetId)
    if (from < 0 || to < 0) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    setDragComicId(null)
    setComics(list)
    await Promise.all(list.map((c, i) => supabase.from('comics').update({ sort_order: i }).eq('id', c.id)))
    setMessage('Orden actualizado')
  }

  const saveChapter = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !selectedComicId) return
    setError('')
    setMessage('')

    const num = Number(chNumber)
    if (!Number.isFinite(num)) {
      setError('El número de capítulo no es válido (usa enteros o decimales, ej. 1.5).')
      return
    }
    const titleTrim = chTitle.trim()
    if (!titleTrim) {
      setError('El título es obligatorio.')
      return
    }

    // No repetir número ni título (salvo el que se está editando)
    const dupNum = chapters.find(
      (c) => Number(c.number) === num && c.id !== editChapterId
    )
    if (dupNum) {
      setError(`Ya existe un capítulo con el número ${num} («${dupNum.title}»).`)
      return
    }
    const dupTitle = chapters.find(
      (c) =>
        c.title.trim().toLowerCase() === titleTrim.toLowerCase() &&
        c.id !== editChapterId
    )
    if (dupTitle) {
      setError(`Ya existe un capítulo con el título «${dupTitle.title}» (#${dupTitle.number}).`)
      return
    }

    let icon_url: string | null = null
    if (chIconFile) {
      const path = `chapter-icons/${selectedComicId}/${Date.now()}-${sanitizeFileName(chIconFile.name)}`
      const { error: upErr } = await supabase.storage.from('comics').upload(path, chIconFile, {
        upsert: true,
        contentType: chIconFile.type || 'image/png',
      })
      if (upErr) {
        setError('Error subiendo icono: ' + upErr.message)
        return
      }
      icon_url = supabase.storage.from('comics').getPublicUrl(path).data.publicUrl
    }

    if (editChapterId) {
      const payload: any = {
        number: num,
        title: titleTrim,
        status: chStatus,
        published_at: chStatus === 'published' ? new Date().toISOString() : null,
      }
      if (icon_url) payload.icon_url = icon_url
      const { error: err } = await supabase.from('chapters').update(payload).eq('id', editChapterId)
      if (err) {
        setError(err.message)
        return
      }
      setMessage('Capítulo actualizado')
      resetChapterForm()
      await loadChapters(selectedComicId)
      return
    }

    const { data: ch, error: err } = await supabase
      .from('chapters')
      .insert({
        comic_id: selectedComicId,
        number: num,
        title: titleTrim,
        status: chStatus,
        icon_url: icon_url,
        published_at: chStatus === 'published' ? new Date().toISOString() : null,
      })
      .select()
      .single()
    if (err || !ch) {
      setError(err?.message || 'Error al crear capítulo')
      return
    }
    if (pageFiles?.length) {
      const files = Array.from(pageFiles).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      )
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const path = `chapters/${ch.id}/${String(i + 1).padStart(3, '0')}-${sanitizeFileName(file.name)}`
        const { error: upErr } = await supabase.storage.from('comics').upload(path, file, {
          upsert: true,
          contentType: file.type || 'image/jpeg',
        })
        if (upErr) {
          setError(upErr.message)
          break
        }
        const url = supabase.storage.from('comics').getPublicUrl(path).data.publicUrl
        await supabase.from('pages').insert({ chapter_id: ch.id, image_url: url, page_number: i + 1 })
      }
    }
    setMessage('Capítulo creado')
    resetChapterForm()
    await loadChapters(selectedComicId)
  }

  const toggleChapterPublish = async (ch: Chapter) => {
    if (!supabase) return
    const next = ch.status === 'published' ? 'draft' : 'published'
    await supabase
      .from('chapters')
      .update({ status: next, published_at: next === 'published' ? new Date().toISOString() : null })
      .eq('id', ch.id)
    await loadChapters(selectedComicId)
  }

  const deleteChapter = async (id: string) => {
    if (!supabase) return
    setModal({
      title: 'Eliminar capítulo',
      body: '¿Seguro que quieres eliminar este capítulo y todas sus páginas?',
      onConfirm: async () => {
        await supabase!.from('chapters').delete().eq('id', id)
        setModal(null)
        await loadChapters(selectedComicId)
      },
    })
  }

  const onPageDrop = async (targetId: string) => {
    if (!supabase || !manageChapterId || !dragPageId || dragPageId === targetId) return
    const list = [...managePages]
    const from = list.findIndex((p) => p.id === dragPageId)
    const to = list.findIndex((p) => p.id === targetId)
    if (from < 0 || to < 0) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    setDragPageId(null)
    setManagePages(list)
    await Promise.all(list.map((p, i) => supabase.from('pages').update({ page_number: i + 1 }).eq('id', p.id)))
  }

  const deletePage = async (id: string) => {
    if (!supabase) return
    setModal({
      title: 'Quitar imagen',
      body: '¿Seguro que quieres quitar esta página del capítulo?',
      onConfirm: async () => {
        await supabase!.from('pages').delete().eq('id', id)
        setModal(null)
        if (manageChapterId) await loadChapterPages(manageChapterId)
      },
    })
  }

  const addMorePages = async () => {
    if (!supabase || !manageChapterId || !addPageFiles?.length) return
    const start = managePages.length
    const files = Array.from(addPageFiles).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const path = `chapters/${manageChapterId}/${String(start + i + 1).padStart(3, '0')}-${sanitizeFileName(file.name)}`
      const { error: upErr } = await supabase.storage.from('comics').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      })
      if (upErr) {
        setError(upErr.message)
        break
      }
      const url = supabase.storage.from('comics').getPublicUrl(path).data.publicUrl
      await supabase.from('pages').insert({
        chapter_id: manageChapterId,
        image_url: url,
        page_number: start + i + 1,
      })
    }
    setAddPageFiles(null)
    await loadChapterPages(manageChapterId)
  }

  const toggleSliderEnabled = async () => {
    if (!supabase) return
    const next = !sliderEnabled
    await supabase.from('site_settings').upsert({ key: 'slider', value: { enabled: next } })
    setSliderEnabled(next)
  }

  const uploadSlides = async () => {
    if (!supabase || !slideFiles?.length) return
    const files = Array.from(slideFiles)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const path = `slider/${Date.now()}-${i}-${sanitizeFileName(file.name)}`
      const { error: upErr } = await supabase.storage.from('comics').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      })
      if (upErr) {
        setError(upErr.message)
        break
      }
      const url = supabase.storage.from('comics').getPublicUrl(path).data.publicUrl
      await supabase.from('slider_images').insert({
        image_url: url,
        sort_order: slides.length + i,
        is_active: true,
      })
    }
    setSlideFiles(null)
    setMessage('Slides subidos')
    await loadSlider()
  }

  const onSlideDrop = async (targetId: string) => {
    if (!supabase || !dragSlideId || dragSlideId === targetId) return
    const list = [...slides]
    const from = list.findIndex((s) => s.id === dragSlideId)
    const to = list.findIndex((s) => s.id === targetId)
    if (from < 0 || to < 0) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    setDragSlideId(null)
    setSlides(list)
    await Promise.all(list.map((s, i) => supabase.from('slider_images').update({ sort_order: i }).eq('id', s.id)))
  }

  const deleteSlide = async (id: string) => {
    if (!supabase) return
    setModal({
      title: 'Quitar del slider',
      body: '¿Seguro que quieres quitar esta imagen del slider de inicio?',
      onConfirm: async () => {
        await supabase!.from('slider_images').delete().eq('id', id)
        setModal(null)
        await loadSlider()
      },
    })
  }

  const toggleCommentDisabled = async (c: CommentRow) => {
    if (!supabase) return
    const next = !c.is_disabled
    await supabase.from('comments').update({ is_disabled: next }).eq('id', c.id)
    setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_disabled: next } : x)))
    if (selectedComment?.id === c.id) setSelectedComment({ ...c, is_disabled: next })
  }

  const deleteComment = async (id: string) => {
    if (!supabase) return
    setModal({
      title: 'Eliminar comentario',
      body: '¿Seguro que quieres eliminar este comentario de forma permanente?',
      onConfirm: async () => {
        await supabase!.from('comments').delete().eq('id', id)
        setComments((prev) => prev.filter((c) => c.id !== id))
        setSelectedComment(null)
        setModal(null)
      },
    })
  }

  const filteredComments = comments.filter((c) => {
    if (cFilterArc !== 'all' && (c.chapters as any)?.comic_id !== cFilterArc) return false
    if (cFilterChapter !== 'all' && c.chapter_id !== cFilterChapter) return false
    if (cFilterUser !== 'all' && c.user_id !== cFilterUser) return false
    if (cSearch.trim()) {
      const q = cSearch.toLowerCase()
      const hay = `${c.content} ${c.profiles?.username || ''} ${(c.chapters as any)?.comics?.title || ''} ${c.chapters?.title || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const uniqueUsers = Array.from(
    new Map(comments.filter((c) => c.profiles?.username).map((c) => [c.user_id, c.profiles!.username!])).entries()
  )

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Comprobando admin…</div>
  }
  if (!allowed) {
    return (
      <>
        <Header />
        <ProfileButton />
        <div style={{
          maxWidth: 480, margin: '48px auto', padding: '36px 28px',
          background: 'var(--card)', borderRadius: 18, textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)', border: '2px solid rgba(192,57,43,0.25)',
        }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🔒</div>
          <h1 style={{ margin: '0 0 10px', color: 'var(--text)' }}>Acceso restringido</h1>
          <p style={{ color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 22px' }}>
            Esta sección está reservada al equipo de administración.
            Si crees que deberías tener acceso, contacta con un administrador.
          </p>
          <button
            type="button"
            onClick={() => navigate('/home')}
            style={{
              padding: '12px 28px', border: 'none', borderRadius: 12, cursor: 'pointer',
              background: '#c0392b', color: '#fff', fontFamily: 'inherit', fontWeight: 'bold', fontSize: 15,
            }}
          >
            Volver
          </button>
        </div>

        <Footer />
      </>
    )
  }

  return (
    <>
      <style>{`
        .admin-wrap { max-width: 1080px; margin: 0 auto; padding: 24px 16px 60px; font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif; }
        .admin-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .admin-tabs button { padding: 11px 18px; border-radius: 12px; border: 2px solid var(--border,#494949); cursor: pointer; background: var(--card); color: var(--text); font-family: inherit; font-weight: bold; }
        .admin-tabs button.active { background: linear-gradient(135deg,#FFFF00,#FFD700); color: #111; border-color: #FFD700; }
        .admin-card { background: var(--card); border-radius: 16px; padding: 22px; margin-bottom: 20px; box-shadow: 0 6px 18px rgba(0,0,0,0.1); }
        .admin-card h2 { margin: 0 0 14px; border-bottom: 3px solid #FFD700; padding-bottom: 8px; }
        .admin-card .field { display: block; margin: 12px 0 5px; font-size: 13px; color: var(--muted); font-weight: bold; }
        .admin-card input[type=text],
        .admin-card input[type=number],
        .admin-card textarea,
        .admin-card select {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 3px solid #494949;
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
          font-size: 15px;
          box-sizing: border-box;
          background: rgb(102, 99, 120);
          color: #0a0a0a;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .admin-card input[type=text]:focus,
        .admin-card input[type=number]:focus,
        .admin-card textarea:focus,
        .admin-card select:focus {
          border-color: #222;
          background: rgb(82, 80, 97);
          box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.25);
          color: #0a0a0a;
        }
        .admin-card textarea {
          resize: vertical;
          min-height: 90px;
          line-height: 1.45;
        }
        .admin-card input::placeholder,
        .admin-card textarea::placeholder {
          color: rgba(10, 10, 10, 0.45);
        }
        .banner-preview {
          display: block;
          margin: 12px auto 0;
          width: 100%;
          max-width: 420px;
          height: 100px;
          object-fit: cover;
          border-radius: 10px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        }
        .icon-preview {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          object-fit: cover;
          border: 2px solid #FFD700;
          margin-top: 10px;
        }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; margin: 10px 0; border-radius: 12px; background: rgba(255,215,0,0.08); border: 1px solid rgba(255,215,0,0.25); }
        .toggle-row span { font-weight: bold; color: var(--text); font-size: 14px; }
        .toggle { position: relative; width: 52px; height: 28px; flex-shrink: 0; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; inset: 0; background: #bbb; border-radius: 28px; cursor: pointer; transition: 0.25s; border: 2px solid #999; }
        .toggle-slider:before { content: ''; position: absolute; height: 20px; width: 20px; left: 2px; bottom: 2px; background: #fff; border-radius: 50%; transition: 0.25s; }
        .toggle input:checked + .toggle-slider { background: linear-gradient(135deg,#FFFF00,#FFD700); border-color: #e6c200; }
        .toggle input:checked + .toggle-slider:before { transform: translateX(24px); }
        .btn-yellow { margin-top: 14px; padding: 12px 20px; border: none; border-radius: 10px; cursor: pointer; background: linear-gradient(135deg,#FFFF00,#FFD700); font-family: inherit; font-weight: bold; }
        .btn-danger { background: #c0392b; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; }
        .btn-small { padding: 7px 12px; margin-right: 6px; border-radius: 8px; border: 1px solid #ccc; cursor: pointer; font-family: inherit; background: var(--bg); color: var(--text); font-size: 13px; }
        .row-list { border-top: 1px solid rgba(128,128,128,0.25); padding: 12px 0; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
        .row-list.draggable { cursor: grab; border-radius: 10px; padding: 12px 10px; border: 1px solid transparent; }
        .row-list.draggable:hover { background: rgba(255,215,0,0.08); border-color: rgba(255,215,0,0.3); }
        .row-list.dragging { opacity: 0.5; }
        .msg { background: #d4edda; color: #155724; padding: 12px; border-radius: 10px; margin-bottom: 12px; }
        .err { background: #f8d7da; color: #721c24; padding: 12px; border-radius: 10px; margin-bottom: 12px; }
        .upload-zone { border: 2px dashed #999; border-radius: 14px; padding: 18px; margin-top: 8px; background: rgba(255,215,0,0.05); text-align: center; }
        .upload-label { display: inline-block; padding: 12px 20px; border-radius: 10px; background: linear-gradient(135deg,#FFFF00,#FFD700); color: #111; font-weight: bold; cursor: pointer; font-family: inherit; }
        .cover-preview { display: block; margin: 12px auto 0; max-width: 140px; border-radius: 10px; }
        .file-list { margin: 12px 0 0; padding-left: 20px; text-align: left; font-size: 13px; color: var(--muted); }
        .page-thumb { width: 44px; height: 58px; object-fit: cover; border-radius: 6px; background: #222; }
        .drag-hint { font-size: 12px; color: var(--muted); margin-bottom: 10px; }
        .filters-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
        .filters-bar input, .filters-bar select { flex: 1; min-width: 140px; padding: 10px 12px; border-radius: 10px; border: 2px solid var(--border,#494949); font-family: inherit; background: var(--bg); color: var(--text); }
        .comment-card { border-top: 1px solid rgba(128,128,128,0.2); padding: 14px 8px; cursor: pointer; border-radius: 10px; }
        .comment-card:hover { background: rgba(255,215,0,0.08); }
        .comment-card.disabled-c { opacity: 0.55; }
        .comment-meta-line { font-size: 12px; color: var(--muted); margin-top: 4px; }
        .detail-panel { background: rgba(0,0,0,0.03); border: 2px solid #FFD700; border-radius: 14px; padding: 16px; margin-top: 12px; }
        .badge-off { display: inline-block; background: #c0392b; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 999px; margin-left: 6px; }
      
        /* admin-input-force */
        .admin-card input[type="text"],
        .admin-card input[type="number"],
        .admin-card input:not([type="checkbox"]):not([type="file"]):not([type="range"]),
        .admin-card select,
        .admin-card textarea {
          width: 100% !important;
          max-width: 100% !important;
          padding: 12px 14px !important;
          border-radius: 10px !important;
          border: 3px solid #494949 !important;
          background: rgb(102, 99, 120) !important;
          color: #0a0a0a !important;
          font-family: inherit !important;
          font-size: 15px !important;
          box-sizing: border-box !important;
        }
        .admin-card label.field,
        .admin-card label {
          display: block !important;
          font-weight: bold !important;
          margin: 12px 0 6px !important;
          color: var(--text) !important;
          font-size: 13px !important;
        }

      `}</style>

      <Header />
      <ProfileButton />

      <div className="admin-wrap">
        <h1>Panel de administración</h1>
        <p style={{ color: 'var(--muted)' }}>Arcos, capítulos, slider y moderación</p>
        {message && <div className="msg">{message}</div>}
        {error && <div className="err">{error}</div>}

        <div className="admin-tabs">
          <button type="button" className={tab === 'comics' ? 'active' : ''} onClick={() => setTab('comics')}>📚 Arcos</button>
          <button type="button" className={tab === 'chapters' ? 'active' : ''} onClick={() => setTab('chapters')}>📖 Capítulos</button>
          <button type="button" className={tab === 'slider' ? 'active' : ''} onClick={() => setTab('slider')}>🖼 Slider</button>
          <button type="button" className={tab === 'comments' ? 'active' : ''} onClick={() => setTab('comments')}>💬 Comentarios</button>
          <button type="button" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>👥 Usuarios</button>
          <button type="button" className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>📊 Estadísticas</button>
        </div>


        {tab === 'users' && (
          <div className="admin-card">
            <h2>Usuarios ({users.length})</h2>
            {users.length === 0 && (
              <p>No hay usuarios cargados. Si el SQL está bien, revisa la consola (F12).</p>
            )}
            {users.map((u) => (
              <div key={u.id} className="row-list" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <Link to={`/profiles/${u.id}`}>
                  <img
                    src={u.avatar_url || '/loguito.png'}
                    alt=""
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #FFD700' }}
                  />
                </Link>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <Link to={`/profiles/${u.id}`} style={{ fontWeight: 'bold', color: 'var(--text)', textDecoration: 'none' }}>
                    {u.username || u.email || u.id?.slice?.(0, 8)}
                  </Link>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {u.role || 'user'}
                    {u.email ? ` · ${u.email}` : ''}
                    {u.banned_until && new Date(u.banned_until) > new Date() ? ' · BAN' : ''}
                    {u.comment_ban_until && new Date(u.comment_ban_until) > new Date() ? ' · MUTE' : ''}
                  </div>
                </div>
                <button type="button" className="btn-small" onClick={() => setModal({
                  title: 'Amonestar usuario',
                  body: `Se impedirá a ${u.username || 'este usuario'} publicar comentarios durante 7 días. Podrás quitar el mute cuando quieras.`,
                  onConfirm: async () => {
                    if (!supabase) return
                    const until = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
                    await supabase.from('profiles').update({ comment_ban_until: until }).eq('id', u.id)
                    setModal(null)
                    loadUsers()
                  }
                })}>Amonestar 7d</button>
                <button type="button" className="btn-small" onClick={() => setModal({
                  title: 'Quitar mute',
                  body: `¿Permitir de nuevo que ${u.username || 'este usuario'} pueda comentar?`,
                  onConfirm: async () => {
                    if (!supabase) return
                    await supabase.from('profiles').update({ comment_ban_until: null }).eq('id', u.id)
                    setModal(null)
                    loadUsers()
                  }
                })}>Quitar mute</button>
                <button type="button" className="btn-small danger" onClick={() => setModal({
                  title: 'Banear usuario',
                  body: `¿Banear a ${u.username || 'este usuario'}? No podrá usar la cuenta con normalidad hasta que quites el ban.`,
                  onConfirm: async () => {
                    if (!supabase) return
                    const until = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
                    await supabase.from('profiles').update({ banned_until: until }).eq('id', u.id)
                    setModal(null)
                    loadUsers()
                  }
                })}>Banear</button>
                <button type="button" className="btn-small" onClick={() => setModal({
                  title: 'Quitar ban',
                  body: `¿Levantar el ban de ${u.username || 'este usuario'}? Recuperará el acceso completo.`,
                  onConfirm: async () => {
                    if (!supabase) return
                    await supabase.from('profiles').update({ banned_until: null }).eq('id', u.id)
                    setModal(null)
                    loadUsers()
                  }
                })}>Quitar ban</button>
              </div>
            ))}
            <h2 style={{ marginTop: 28 }}>Intentos de acceso al panel</h2>
            <p className="drag-hint">Quién intentó entrar al admin (permitido o no).</p>
            {accessLogs.length === 0 && <p>Sin registros todavía.</p>}
            {accessLogs.map((log) => (
              <div key={log.id} className="row-list">
                <div>
                  <strong>{log.username || log.email || log.user_id || 'Anónimo'}</strong>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {new Date(log.created_at).toLocaleString('es-ES')}
                    {log.allowed ? ' · permitido' : ' · denegado'}
                  </div>
                </div>
                {log.user_id && (
                  <Link className="btn-small" to={`/profiles/${log.user_id}`} style={{ textDecoration: 'none' }}>Perfil</Link>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'stats' && (
          <>
            <div className="admin-card">
              <h2>Estadísticas globales</h2>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120, padding: 16, borderRadius: 12, background: 'rgba(255,215,0,0.1)', border: '2px solid #FFD700', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 'bold' }}>{stats.views}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Vistas totales</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: 16, borderRadius: 12, background: 'rgba(255,77,109,0.08)', border: '2px solid #ff4d6d', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff2d55' }}>{stats.likes}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Likes</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: 16, borderRadius: 12, background: 'rgba(59,130,246,0.1)', border: '2px solid #3b82f6', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 'bold' }}>{stats.comments}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Comentarios</div>
                </div>
              </div>
            </div>
            <div className="admin-card">
              <h2>Por arco</h2>
              {comicStats.length === 0 && <p>Sin datos todavía.</p>}
              {comicStats.map((c) => (
                <div key={c.id} className="row-list">
                  <div style={{ flex: 1 }}>
                    <strong>{c.title}</strong>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{c.chapters} capítulos</div>
                  </div>
                  <span>👁 {c.views}</span>
                  <span style={{ color: '#ff2d55' }}>♥ {c.likes}</span>
                  <span>💬 {c.comments}</span>
                </div>
              ))}
            </div>
            <div className="admin-card">
              <h2>Por capítulo</h2>
              {chapterStats.length === 0 && <p>Sin datos todavía.</p>}
              {chapterStats.map((ch) => (
                <div key={ch.id} className="row-list">
                  <div style={{ flex: 1 }}>
                    <strong>#{ch.number} — {ch.title}</strong>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{ch.comic}</div>
                  </div>
                  <span>👁 {ch.views}</span>
                  <span style={{ color: '#ff2d55' }}>♥ {ch.likes}</span>
                  <span>💬 {ch.comments}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'comics' && (
          <>
            <div className="admin-card">
              <h2>{editId ? 'Editar arco' : 'Nuevo arco'}</h2>
              <form onSubmit={saveComic}>
                <label className="field">Título</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
                <label className="field">Descripción</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                <label className="field">Género</label>
                <input value={genre} onChange={(e) => setGenre(e.target.value)} />
                <label className="field">Estado</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Borrador</option>
                  <option value="ongoing">En curso</option>
                  <option value="completed">Completo</option>
                  <option value="hiatus">Pausa</option>
                </select>
                <div className="toggle-row">
                  <span>⭐ Principal (Inicio)</span>
                  <label className="toggle">
                    <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="toggle-row">
                  <span>✓ Arco finalizado</span>
                  <label className="toggle">
                    <input type="checkbox" checked={isFinished} onChange={(e) => setIsFinished(e.target.checked)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <label className="field">Portada vertical</label>
                <div className="upload-zone">
                  <input type="file" accept="image/*" id="cover-in" style={{ display: 'none' }} onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setCoverFile(f)
                    if (f) setCoverPreview(URL.createObjectURL(f))
                  }} />
                  <label htmlFor="cover-in" className="upload-label">{coverPreview ? 'Cambiar portada' : '📷 Portada vertical'}</label>
                  {coverPreview && <img src={coverPreview} className="cover-preview" alt="" />}
                </div>
                <label className="field">Banner horizontal (detalle del arco)</label>
                <div className="upload-zone">
                  <input type="file" accept="image/*" id="banner-in" style={{ display: 'none' }} onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setBannerFile(f)
                    if (f) setBannerPreview(URL.createObjectURL(f))
                  }} />
                  <label htmlFor="banner-in" className="upload-label">{bannerPreview ? 'Cambiar banner' : '🖼 Banner horizontal'}</label>
                  {bannerPreview && <img src={bannerPreview} className="banner-preview" alt="" />}
                </div>
                <button type="submit" className="btn-yellow">{editId ? 'Guardar' : 'Crear arco'}</button>
                {editId && <button type="button" className="btn-small" onClick={resetComicForm}>Cancelar</button>}
              </form>
            </div>
            <div className="admin-card">
              <h2>Arcos · arrastra para ordenar</h2>
              <p className="drag-hint">Arrastra un arco sobre otro para cambiar el orden del Inicio.</p>
              {comics.map((c) => (
                <div
                  key={c.id}
                  className={`row-list draggable ${dragComicId === c.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => setDragComicId(c.id)}
                  onDragOver={(e: DragEvent) => e.preventDefault()}
                  onDrop={() => onComicDrop(c.id)}
                  onDragEnd={() => setDragComicId(null)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ opacity: 0.4 }}>⋮⋮</span>
                    {c.cover_url && <img src={c.cover_url} className="page-thumb" alt="" />}
                    <div>
                      <strong>{c.title}</strong>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {c.status} · {c.genre || '—'}
                        {c.is_featured ? ' · ⭐' : ''}
                        {c.is_finished ? ' · ✓' : ''}
                      </div>
                    </div>
                  </div>
                  <div>
                    <button type="button" className="btn-small" onClick={() => startEdit(c)}>Editar</button>
                    <button type="button" className="btn-small" onClick={() => { setSelectedComicId(c.id); setTab('chapters') }}>Capítulos</button>
                    <Link className="btn-small" to={`/comic/${c.id}`} style={{ display: 'inline-block', textDecoration: 'none' }}>Ver</Link>
                    <button type="button" className="btn-danger" onClick={() => deleteComic(c.id)}>Borrar</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'chapters' && (
          <>
            <div className="admin-card">
              <h2>Elegir arco</h2>
              <select value={selectedComicId} onChange={(e) => setSelectedComicId(e.target.value)}>
                <option value="">— Selecciona —</option>
                {comics.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            {selectedComicId && (
              <div className="admin-card">
                <h2>{editChapterId ? 'Editar capítulo' : 'Nuevo capítulo'}</h2>
                <p className="drag-hint">
                  Número sugerido según el orden actual. Puedes usar decimales (ej. 1.5). No se repiten número ni título.
                </p>
                <form onSubmit={saveChapter}>
                  <label className="field">Número (entero o decimal)</label>
                  <input
                    type="number"
                    step="any"
                    value={chNumber}
                    onChange={(e) => setChNumber(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                  <label className="field">Título</label>
                  <input value={chTitle} onChange={(e) => setChTitle(e.target.value)} required placeholder="Título del capítulo" />
                  <label className="field">Estado</label>
                  <select value={chStatus} onChange={(e) => setChStatus(e.target.value)}>
                    <option value="draft">Borrador</option>
                    <option value="published">Publicado</option>
                  </select>
                  <label className="field">Icono del capítulo</label>
                  <div className="upload-zone">
                    <input
                      type="file"
                      accept="image/*"
                      id="icon-in"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null
                        setChIconFile(f)
                        if (f) setChIconPreview(URL.createObjectURL(f))
                      }}
                    />
                    <label htmlFor="icon-in" className="upload-label">
                      {chIconPreview ? 'Cambiar icono' : '⭐ Elegir icono'}
                    </label>
                    {chIconPreview && <img src={chIconPreview} className="icon-preview" alt="" />}
                  </div>
                  {!editChapterId && (
                    <>
                      <label className="field">Páginas (solo al crear; luego usa «Páginas»)</label>
                      <div className="upload-zone">
                        <input type="file" accept="image/*" multiple id="pages-in" style={{ display: 'none' }} onChange={(e) => {
                          setPageFiles(e.target.files)
                          setPagePreviewNames(e.target.files ? Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((f) => f.name) : [])
                        }} />
                        <label htmlFor="pages-in" className="upload-label">📄 Elegir páginas</label>
                        {pagePreviewNames.length > 0 && <ol className="file-list">{pagePreviewNames.map((n, i) => <li key={i}>{i + 1}. {n}</li>)}</ol>}
                      </div>
                    </>
                  )}
                  <button type="submit" className="btn-yellow">
                    {editChapterId ? 'Guardar cambios' : 'Crear y subir'}
                  </button>
                  {editChapterId && (
                    <button type="button" className="btn-small" style={{ marginLeft: 8 }} onClick={resetChapterForm}>
                      Cancelar edición
                    </button>
                  )}
                </form>
              </div>
            )}
            {selectedComicId && (
              <div className="admin-card">
                <h2>Capítulos</h2>
                {chapters.map((ch) => (
                  <div key={ch.id} className="row-list">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {ch.icon_url ? (
                        <img src={ch.icon_url} alt="" className="icon-preview" style={{ marginTop: 0 }} />
                      ) : (
                        <span style={{ width: 48, height: 48, borderRadius: 10, background: '#333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontWeight: 'bold' }}>
                          #{ch.number}
                        </span>
                      )}
                      <div>
                        <strong>#{ch.number} — {ch.title}</strong>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{ch.status}</div>
                      </div>
                    </div>
                    <div>
                      <button type="button" className="btn-small" onClick={() => startEditChapter(ch)}>Editar</button>
                      <button type="button" className="btn-small" onClick={() => toggleChapterPublish(ch)}>{ch.status === 'published' ? 'Despublicar' : 'Publicar'}</button>
                      <button type="button" className="btn-small" onClick={() => loadChapterPages(ch.id)}>Páginas</button>
                      <Link className="btn-small" to={`/comic/${selectedComicId}/chapter/${ch.id}`} style={{ display: 'inline-block', textDecoration: 'none' }}>Leer</Link>
                      <button type="button" className="btn-danger" onClick={() => deleteChapter(ch.id)}>Borrar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {manageChapterId && (
              <div className="admin-card">
                <h2>Páginas · arrastra para reordenar</h2>
                {managePages.map((p) => (
                  <div key={p.id} className={`row-list draggable ${dragPageId === p.id ? 'dragging' : ''}`}
                    draggable onDragStart={() => setDragPageId(p.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => onPageDrop(p.id)} onDragEnd={() => setDragPageId(null)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ opacity: 0.4 }}>⋮⋮</span>
                      <img src={p.image_url} className="page-thumb" alt="" />
                      <span>#{p.page_number}</span>
                    </div>
                    <button type="button" className="btn-danger" onClick={() => deletePage(p.id)}>Borrar</button>
                  </div>
                ))}
                <div className="upload-zone" style={{ marginTop: 16 }}>
                  <input type="file" accept="image/*" multiple id="add-pg" style={{ display: 'none' }} onChange={(e) => setAddPageFiles(e.target.files)} />
                  <label htmlFor="add-pg" className="upload-label">＋ Añadir páginas</label>
                  {addPageFiles && addPageFiles.length > 0 && (
                    <button type="button" className="btn-yellow" onClick={addMorePages}>Subir {addPageFiles.length}</button>
                  )}
                </div>
                <button type="button" className="btn-small" style={{ marginTop: 12 }} onClick={() => setManageChapterId(null)}>Cerrar</button>
              </div>
            )}
          </>
        )}

        {tab === 'slider' && (
          <>
            <div className="admin-card">
              <h2>Slider</h2>
              <div className="toggle-row">
                <span>🖼 Slider activo</span>
                <label className="toggle">
                  <input type="checkbox" checked={sliderEnabled} onChange={toggleSliderEnabled} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="upload-zone" style={{ marginTop: 16 }}>
                <input type="file" accept="image/*" multiple id="slides-in" style={{ display: 'none' }} onChange={(e) => setSlideFiles(e.target.files)} />
                <label htmlFor="slides-in" className="upload-label">
                  {slideFiles?.length ? `${slideFiles.length} seleccionada(s)` : '🖼 Subir varias imágenes'}
                </label>
                {slideFiles && slideFiles.length > 0 && (
                  <button type="button" className="btn-yellow" onClick={uploadSlides}>Subir al slider</button>
                )}
              </div>
            </div>
            <div className="admin-card">
              <h2>Imágenes · arrastra para ordenar</h2>
              {slides.map((s) => (
                <div key={s.id} className={`row-list draggable ${dragSlideId === s.id ? 'dragging' : ''}`}
                  draggable onDragStart={() => setDragSlideId(s.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => onSlideDrop(s.id)} onDragEnd={() => setDragSlideId(null)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ opacity: 0.4 }}>⋮⋮</span>
                    <img src={s.image_url} alt="" style={{ width: 120, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                  </div>
                  <button type="button" className="btn-danger" onClick={() => deleteSlide(s.id)}>Quitar</button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'comments' && (
          <div className="admin-card">
            <h2>Moderar comentarios</h2>
            <div className="filters-bar">
              <input placeholder="Buscar texto, usuario o arco…" value={cSearch} onChange={(e) => setCSearch(e.target.value)} />
              <select value={cFilterArc} onChange={(e) => { setCFilterArc(e.target.value); setCFilterChapter('all') }}>
                <option value="all">Todos los arcos</option>
                {comics.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <select value={cFilterChapter} onChange={(e) => setCFilterChapter(e.target.value)}>
                <option value="all">Todos los capítulos</option>
                {Array.from(new Map(comments.filter((c) => c.chapters).map((c) => [c.chapter_id, c.chapters!])).entries())
                  .filter(([, ch]) => cFilterArc === 'all' || (ch as any).comic_id === cFilterArc)
                  .map(([id, ch]) => (
                    <option key={id} value={id}>#{ch.number} {ch.title}</option>
                  ))}
              </select>
              <select value={cFilterUser} onChange={(e) => setCFilterUser(e.target.value)}>
                <option value="all">Todos los perfiles</option>
                {uniqueUsers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{filteredComments.length} comentario(s)</p>
            {filteredComments.map((c) => {
              const arc = (c.chapters as any)?.comics?.title || '—'
              const ch = c.chapters ? `#${c.chapters.number} ${c.chapters.title}` : '—'
              return (
                <div key={c.id} className={`comment-card ${c.is_disabled ? 'disabled-c' : ''}`} onClick={() => setSelectedComment(c)}>
                  <strong>{c.profiles?.username || 'Usuario'}</strong>
                  {c.is_disabled && <span className="badge-off">Deshabilitado</span>}
                  <p style={{ margin: '6px 0' }}>{c.content}</p>
                  <div className="comment-meta-line">{arc} · {ch} · {new Date(c.created_at).toLocaleString()}</div>
                </div>
              )
            })}
            {selectedComment && (
              <div className="detail-panel">
                <h3 style={{ marginTop: 0 }}>Detalle</h3>
                <p>
                  <strong>Usuario:</strong>{' '}
                  <Link to={`/profiles/${selectedComment.user_id}`}>
                    {selectedComment.profiles?.username || selectedComment.user_id}
                  </Link>
                </p>
                <p>{selectedComment.content}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button type="button" className="btn-small" onClick={() => toggleCommentDisabled(selectedComment)}>
                    {selectedComment.is_disabled ? 'Habilitar' : 'Deshabilitar'}
                  </button>
                  <button type="button" className="btn-danger" onClick={() => deleteComment(selectedComment.id)}>Borrar</button>
                  <button type="button" className="btn-small" onClick={() => setSelectedComment(null)}>Cerrar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {modal && (
        <div onClick={() => setModal(null)} style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:'var(--card)', color:'var(--text)', border:'3px solid #FFD700', borderRadius:16, padding:24, maxWidth:420, width:'100%' }}>
            <h3 style={{ marginTop:0 }}>{modal.title}</h3>
            <p style={{ color:'var(--muted)' }}>{modal.body}</p>
            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button type="button" onClick={() => setModal(null)} style={{ flex:1, padding:12, border:'none', borderRadius:10, background:'#666', color:'#fff', fontFamily:'inherit', fontWeight:'bold', cursor:'pointer' }}>Cancelar</button>
              <button type="button" onClick={() => modal.onConfirm?.()} style={{ flex:1, padding:12, border:'none', borderRadius:10, background:'#c0392b', color:'#fff', fontFamily:'inherit', fontWeight:'bold', cursor:'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  )
}