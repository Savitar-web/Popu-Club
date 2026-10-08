import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [editMode, setEditMode] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [form, setForm] = useState({
    username: '',
    age: '',
    showAge: true,
    description: '',
    banner: '',
    profilePic: '/loguito.png',
    showLikes: true,
    showComments: true,
    showFolders: true,
  })

  const [myComments, setMyComments] = useState<any[]>([])
  const [likesCh, setLikesCh] = useState<any[]>([])
  const [likesCm, setLikesCm] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [folderName, setFolderName] = useState('')
  const [folderItems, setFolderItems] = useState<Record<string, any[]>>({})
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [allComics, setAllComics] = useState<any[]>([])
  const [comicSearch, setComicSearch] = useState('')
  const [wall, setWall] = useState<any[]>([])
  const [wallText, setWallText] = useState('')
  const [replyTo, setReplyTo] = useState<any | null>(null)
  const [posting, setPosting] = useState(false)
  const [modal, setModal] = useState<{ title: string; body: string; onConfirm?: () => void } | null>(null)

  const [showCropper, setShowCropper] = useState(false)
  const [cropType, setCropType] = useState<'avatar' | 'banner'>('avatar')
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [livePreview, setLivePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const persistLocal = (updated: any) => {
    localStorage.setItem('currentUser', JSON.stringify(updated))
    localStorage.setItem('username', updated.username || '')
    localStorage.setItem('age', updated.age != null ? String(updated.age) : '')
    localStorage.setItem('profilePic', updated.profilePic || updated.avatar_url || '/loguito.png')
    localStorage.setItem('role', updated.role || 'user')
    window.dispatchEvent(new Event('profileUpdated'))
  }

  useEffect(() => {
    ;(async () => {
      if (!isSupabaseConfigured || !supabase) {
        const current = localStorage.getItem('currentUser')
        if (!current) { navigate('/login'); return }
        const parsed = JSON.parse(current)
        setUser(parsed)
        setForm((f) => ({
          ...f,
          username: parsed.username || '',
          age: parsed.age != null ? String(parsed.age) : '',
          showAge: parsed.showAge !== false,
          description: parsed.description || '',
          banner: parsed.banner || '',
          profilePic: parsed.profilePic || '/loguito.png',
        }))
        return
      }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { navigate('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
      const u = {
        id: authUser.id,
        email: authUser.email,
        username: profile?.username || '',
        age: profile?.age ?? '',
        showAge: profile?.show_age !== false,
        description: profile?.description || '',
        banner: profile?.banner || '',
        profilePic: profile?.avatar_url || '/loguito.png',
        role: profile?.role || 'user',
        showLikes: profile?.show_likes !== false,
        showComments: profile?.show_comments !== false,
        showFolders: profile?.show_folders !== false,
      }
      setUser(u)
      setForm({
        username: u.username,
        age: String(u.age ?? ''),
        showAge: u.showAge,
        description: u.description,
        banner: u.banner,
        profilePic: u.profilePic,
        showLikes: u.showLikes,
        showComments: u.showComments,
        showFolders: u.showFolders,
      })
      persistLocal(u)

      const { data: cm } = await supabase
        .from('comments')
        .select('id, content, created_at, chapter_id, chapters(title, number, comic_id, comics(title, cover_url))')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(40)
      setMyComments(cm || [])

      const { data: lk } = await supabase
        .from('likes')
        .select('id, created_at, chapter_id, chapters(title, number, comic_id, comics(title, cover_url))')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(40)
      setLikesCh(lk || [])

      const { data: clk } = await supabase
        .from('comment_likes')
        .select(`
          id, created_at, comment_id,
          comments(
            content, chapter_id, user_id,
            profiles:user_id(username, avatar_url),
            chapters(title, number, comic_id, comics(title))
          )
        `)
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(40)
      setLikesCm(clk || [])

      const { data: fd } = await supabase
        .from('favorite_folders')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: true })
      setFolders(fd || [])
      const items: Record<string, any[]> = {}
      for (const f of fd || []) {
        const { data: it } = await supabase
          .from('favorite_items')
          .select('id, comic_id, comics(id, title, cover_url)')
          .eq('folder_id', f.id)
        items[f.id] = it || []
      }
      setFolderItems(items)

      const { data: arcs } = await supabase
        .from('comics')
        .select('id, title, cover_url, status')
        .neq('status', 'draft')
        .order('title')
      setAllComics(arcs || [])

      const { data: wallRaw } = await supabase
        .from('profile_wall')
        .select('id, content, created_at, author_id, is_disabled, parent_id')
        .eq('profile_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(80)
      const posts = wallRaw || []
      const aIds = [...new Set(posts.map((x: any) => x.author_id).filter(Boolean))]
      const authors: Record<string, any> = {}
      if (aIds.length) {
        const { data: aps } = await supabase.from('profiles').select('id, username, avatar_url').in('id', aIds)
        ;(aps || []).forEach((a: any) => { authors[a.id] = a })
      }
      setWall(posts.map((w: any) => ({ ...w, profiles: authors[w.author_id] || null })))
    })()

    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [navigate])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedAreaPixels(pixels), [])

  useEffect(() => {
    if (!imageSrc || !croppedAreaPixels) { setLivePreview(null); return }
    const run = async () => {
      const image = new Image()
      image.src = imageSrc
      await new Promise((r) => (image.onload = r))
      const temp = document.createElement('canvas')
      const ctx = temp.getContext('2d')
      if (!ctx) return
      if (cropType === 'avatar') {
        const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height)
        temp.width = size
        temp.height = size
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(image, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, size, size)
      } else {
        temp.width = croppedAreaPixels.width
        temp.height = croppedAreaPixels.height
        ctx.drawImage(image, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, temp.width, temp.height)
      }
      const final = document.createElement('canvas')
      final.width = cropType === 'avatar' ? 512 : 1200
      final.height = cropType === 'avatar' ? 512 : 300
      final.getContext('2d')?.drawImage(temp, 0, 0, final.width, final.height)
      setLivePreview(final.toDataURL('image/jpeg', 0.9))
    }
    run()
  }, [imageSrc, croppedAreaPixels, cropType])

  const openCropper = (type: 'avatar' | 'banner') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (!f) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCropType(type)
          setImageSrc(reader.result)
          setShowCropper(true)
          setZoom(1)
          setCrop({ x: 0, y: 0 })
        }
      }
      reader.readAsDataURL(f)
    }
    input.click()
  }

  const handleApplyCrop = async () => {
    if (!livePreview || !user || !supabase) return
    setSaving(true)
    let url = livePreview
    try {
      const res = await fetch(livePreview)
      const blob = await res.blob()
      const path = cropType === 'avatar' ? `avatars/${user.id}-${Date.now()}.jpg` : `banners/${user.id}-${Date.now()}.jpg`
      await supabase.storage.from('comics').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      url = supabase.storage.from('comics').getPublicUrl(path).data.publicUrl
    } catch { /* fallback */ }
    const patch: any = cropType === 'avatar' ? { avatar_url: url } : { banner: url }
    await supabase.from('profiles').update(patch).eq('id', user.id)
    if (cropType === 'avatar') setForm((f) => ({ ...f, profilePic: url }))
    else setForm((f) => ({ ...f, banner: url }))
    const updated = {
      ...user,
      profilePic: cropType === 'avatar' ? url : form.profilePic,
      banner: cropType === 'banner' ? url : form.banner,
    }
    setUser(updated)
    persistLocal(updated)
    setShowCropper(false)
    setImageSrc(null)
    setLivePreview(null)
    setSaving(false)
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    if (supabase) {
      await supabase.from('profiles').update({
        username: form.username,
        age: form.age ? Number(form.age) : null,
        show_age: form.showAge,
        description: form.description,
        show_likes: form.showLikes,
        show_comments: form.showComments,
        show_folders: form.showFolders,
      }).eq('id', user.id)
    }
    const updated = { ...user, ...form, age: form.age }
    setUser(updated)
    persistLocal(updated)
    setEditMode(false)
    setSaving(false)
  }

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut()
    ;['currentUser', 'username', 'email', 'age', 'profilePic', 'role'].forEach((k) => localStorage.removeItem(k))
    window.dispatchEvent(new Event('profileUpdated'))
    window.location.assign('/login')
  }

  const postWall = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !user || !wallText.trim()) return
    setPosting(true)
    try {
      const payload: any = {
        profile_id: user.id,
        author_id: user.id,
        content: wallText.trim(),
      }
      if (replyTo?.id) payload.parent_id = replyTo.id
      let data: any = null
      let err: any = null
      const res = await supabase
        .from('profile_wall')
        .insert(payload)
        .select('id, content, created_at, author_id, is_disabled, parent_id')
        .single()
      data = res.data
      err = res.error
      if (err?.message?.includes('parent_id')) {
        const res2 = await supabase
          .from('profile_wall')
          .insert({ profile_id: user.id, author_id: user.id, content: wallText.trim() })
          .select('id, content, created_at, author_id, is_disabled')
          .single()
        data = res2.data
        err = res2.error
      }
      if (err) {
        setModal({ title: 'Error', body: err.message })
        return
      }
      setWall((prev) => [
        {
          ...data,
          profiles: { username: user.username, avatar_url: form.profilePic },
        },
        ...prev,
      ])
      setWallText('')
      setReplyTo(null)
    } finally {
      setPosting(false)
    }
  }

  const createFolder = async () => {
    if (!supabase || !user || !folderName.trim()) return
    const { data, error } = await supabase
      .from('favorite_folders')
      .insert({ user_id: user.id, name: folderName.trim() })
      .select()
      .single()
    if (!error && data) {
      setFolders((prev) => [...prev, data])
      setFolderItems((prev) => ({ ...prev, [data.id]: [] }))
      setFolderName('')
    }
  }

  const deleteFolder = (id: string) => {
    setModal({
      title: 'Borrar carpeta',
      body: '¿Eliminar esta carpeta?',
      onConfirm: async () => {
        if (!supabase) return
        await supabase.from('favorite_folders').delete().eq('id', id)
        setFolders((prev) => prev.filter((f) => f.id !== id))
        if (activeFolder === id) setActiveFolder(null)
        setModal(null)
      },
    })
  }

  const addComicToFolder = async (folderId: string, comicId: string) => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('favorite_items')
      .insert({ folder_id: folderId, comic_id: comicId })
      .select('id, comic_id, comics(id, title, cover_url)')
      .single()
    if (!error && data) {
      setFolderItems((prev) => ({ ...prev, [folderId]: [...(prev[folderId] || []), data] }))
    }
  }

  const removeFromFolder = async (folderId: string, itemId: string) => {
    if (!supabase) return
    await supabase.from('favorite_items').delete().eq('id', itemId)
    setFolderItems((prev) => ({
      ...prev,
      [folderId]: (prev[folderId] || []).filter((x) => x.id !== itemId),
    }))
  }

  const deleteWallPost = (id: string) => {
    setModal({
      title: 'Borrar del muro',
      body: '¿Eliminar este mensaje?',
      onConfirm: async () => {
        if (!supabase) return
        await supabase.from('profile_wall').delete().eq('id', id)
        setWall((prev) => prev.filter((w) => w.id !== id && w.parent_id !== id))
        setModal(null)
      },
    })
  }

  if (!user) return null

  const filteredComics = allComics.filter(
    (c) => !comicSearch.trim() || c.title.toLowerCase().includes(comicSearch.toLowerCase())
  )
  const roots = wall.filter((w) => !w.parent_id)
  const repliesOf = (id: string) => wall.filter((w) => w.parent_id === id)

  return (
    <>
      <style>{`
        .pf {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 16px 48px;
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
        }
        .pf-hero {
          position: relative;
          margin: 0 -16px 0;
          height: 220px;
          background: linear-gradient(135deg, #2a2a2a, #444);
          background-size: cover;
          background-position: center;
          cursor: pointer;
        }
        .pf-hero::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.55), transparent 50%);
          pointer-events: none;
        }
        .pf-hero-inner {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 16px;
          position: relative;
          height: 100%;
        }
        .pf-avatar {
          position: absolute;
          left: 16px;
          bottom: -48px;
          width: 112px;
          height: 112px;
          border-radius: 50%;
          border: 4px solid var(--card, #fff);
          object-fit: cover;
          background: #222;
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
          z-index: 2;
          cursor: pointer;
        }
        .pf-actions-top {
          position: absolute;
          right: 16px;
          bottom: 14px;
          z-index: 2;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .pf-btn {
          padding: 9px 16px;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          font-weight: bold;
          font-size: 13px;
          cursor: pointer;
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: #111;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }
        .pf-btn.ghost {
          background: rgba(0,0,0,0.45);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.35);
        }
        .pf-btn.danger { background: #c0392b; color: #fff; }
        .pf-identity {
          margin-top: 60px;
          margin-bottom: 22px;
          padding-left: 4px;
        }
        .pf-identity h1 {
          margin: 0 0 6px;
          font-size: 1.75rem;
          color: var(--text);
        }
        .pf-identity .meta {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
        }
        .pf-identity .bio {
          margin: 10px 0 0;
          color: var(--text);
          white-space: pre-wrap;
          line-height: 1.45;
          max-width: 640px;
        }
        .pf-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 860px) {
          .pf-layout { grid-template-columns: 1fr; }
          .pf-side { order: 2; }
          .pf-main { order: 1; }
        }
        .pf-card {
          background: var(--card);
          border-radius: 16px;
          padding: 18px 18px 16px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
          margin-bottom: 16px;
        }
        .pf-card h2 {
          margin: 0 0 14px;
          font-size: 1.05rem;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 10px;
          border-bottom: 2px solid #FFD700;
        }
        .pf-card h3 {
          margin: 16px 0 10px;
          font-size: 0.95rem;
          color: var(--muted);
        }
        .wall-empty {
          text-align: center;
          color: var(--muted);
          padding: 28px 12px;
          font-size: 14px;
        }
        .wall-item {
          display: flex;
          gap: 12px;
          padding: 14px 0;
          border-top: 1px solid rgba(128,128,128,0.18);
        }
        .wall-item:first-of-type { border-top: none; }
        .wall-item.reply {
          margin-left: 28px;
          border-left: 2px solid rgba(255,215,0,0.35);
          padding-left: 12px;
        }
        .wall-item img {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #FFD700;
          flex-shrink: 0;
        }
        .wall-meta { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
        .wall-meta a { color: var(--text); font-weight: bold; text-decoration: none; }
        .wall-text { color: var(--text); white-space: pre-wrap; line-height: 1.4; font-size: 14px; }
        .wall-del {
          margin-top: 6px;
          padding: 5px 10px;
          font-size: 12px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #c0392b;
          font-family: inherit;
          font-weight: bold;
          cursor: pointer;
        }
        .wall-actions button {
          border: none; background: transparent; color: var(--muted);
          font-family: inherit; font-size: 12px; font-weight: bold; cursor: pointer; padding: 4px 8px;
        }
        .side-list { max-height: 220px; overflow-y: auto; }
        .side-item {
          padding: 10px 0;
          border-top: 1px solid rgba(128,128,128,0.15);
          font-size: 13px;
        }
        .side-item:first-child { border-top: none; }
        .side-item a { color: var(--text); text-decoration: none; font-weight: bold; }
        .side-item a:hover { color: #c9a000; }
        .side-item .sub { font-size: 11px; color: var(--muted); margin-bottom: 2px; }
        .folder-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          margin: 3px;
          border-radius: 999px;
          border: 2px solid var(--border, #494949);
          cursor: pointer;
          font-weight: bold;
          font-size: 12px;
          color: var(--text);
          background: transparent;
        }
        .folder-chip.active {
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: #111;
          border-color: #FFD700;
        }
        .fav-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }
        .fav-grid img {
          width: 100%;
          aspect-ratio: 3/4;
          object-fit: cover;
          border-radius: 8px;
        }
        .field-input, .field-textarea {
          width: 100%;
          max-width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          border: 3px solid #494949;
          background: rgb(102,99,120);
          color: #0a0a0a;
          font-family: inherit;
          font-size: 14px;
          box-sizing: border-box;
        }
        .field-textarea { min-height: 80px; resize: vertical; }
        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
        }
        .switch { position: relative; display: inline-block; width: 48px; height: 26px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
          position: absolute; cursor: pointer; inset: 0; background: #ccc;
          transition: 0.25s; border-radius: 26px; border: 2px solid #999;
        }
        .slider:before {
          position: absolute; content: ""; height: 18px; width: 18px;
          left: 2px; bottom: 2px; background: white; transition: 0.25s; border-radius: 50%;
        }
        input:checked + .slider { background: #FFD700; border-color: #e6c200; }
        input:checked + .slider:before { transform: translateX(22px); }
        .comic-pick {
          max-height: 160px;
          overflow-y: auto;
          border: 2px solid var(--border, #494949);
          border-radius: 10px;
          margin-top: 8px;
        }
        .comic-pick button {
          display: block; width: 100%; text-align: left; padding: 10px 12px;
          border: none; border-bottom: 1px solid rgba(128,128,128,0.12);
          background: transparent; color: var(--text); font-family: inherit; cursor: pointer; font-size: 13px;
        }
        .comic-pick button:hover { background: rgba(255,215,0,0.12); }
        .muted { color: var(--muted); font-size: 13px; }
        .cropper-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 1000;
          display: flex; justify-content: center; align-items: center; padding: 12px;
        }
        .cropper-modal {
          background: rgba(255,255,255,0.97); border: 4px solid #FFD700;
          border-radius: 16px; width: 100%; max-width: 440px; overflow: hidden;
        }
        .cropper-header {
          padding: 14px; background: #333; color: white; text-align: center;
          border-bottom: 3px solid #FFD700; font-weight: bold;
        }
        .cropper-area { position: relative; height: 220px; background: #111; }
        .cropper-actions { display: flex; gap: 8px; padding: 12px 16px 16px; }
        .cropper-actions button {
          flex: 1; padding: 11px; border: none; border-radius: 8px;
          font-family: inherit; cursor: pointer; font-weight: bold;
        }
        .btn-apply { background: linear-gradient(135deg, #FFFF00, #FFD700); }
        .btn-cancel { background: #666; color: white; }
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 2000;
          display: flex; justify-content: center; align-items: center; padding: 16px;
        }
        .modal-box {
          background: var(--card); color: var(--text); border: 3px solid #FFD700;
          border-radius: 16px; padding: 24px; max-width: 380px; width: 100%; text-align: center;
        }
        .modal-actions { display: flex; gap: 10px; margin-top: 16px; }
        .modal-actions button {
          flex: 1; padding: 11px; border: none; border-radius: 10px;
          font-family: inherit; font-weight: bold; cursor: pointer;
        }
        .modal-danger { background: #c0392b; color: #fff; }
        .modal-cancel { background: #666; color: #fff; }
        .lightbox {
          position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,0.92);
          display: flex; align-items: center; justify-content: center; cursor: zoom-out;
        }
        .lightbox img { max-width: 95%; max-height: 95%; object-fit: contain; }
        .reply-banner {
          font-size: 13px; color: var(--muted); margin-bottom: 8px;
          display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
        }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="pf">
        <div
          className="pf-hero"
          style={form.banner ? { backgroundImage: `url(${form.banner})` } : undefined}
          onClick={() => openCropper('banner')}
        >
          <div className="pf-hero-inner">
            <img
              className="pf-avatar"
              src={form.profilePic}
              alt=""
              onClick={(e) => {
                e.stopPropagation()
                openCropper('avatar')
              }}
            />
            <div className="pf-actions-top" onClick={(e) => e.stopPropagation()}>
              {!editMode && (
                <>
                  <button type="button" className="pf-btn" onClick={() => setEditMode(true)}>Editar</button>
                  {user.role === 'admin' && (
                    <Link to="/admin" className="pf-btn ghost">Admin</Link>
                  )}
                  <button type="button" className="pf-btn danger" onClick={() => setConfirmLogout(true)}>Salir</button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="pf-identity">
          {editMode ? (
            <div style={{ maxWidth: 480 }}>
              <label className="muted">Usuario</label>
              <input className="field-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={{ marginBottom: 10 }} />
              <label className="muted">Descripción</label>
              <textarea className="field-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ marginBottom: 10 }} />
              <div className="toggle-row">
                <span>Mostrar edad</span>
                <label className="switch"><input type="checkbox" checked={form.showAge} onChange={(e) => setForm({ ...form, showAge: e.target.checked })} /><span className="slider" /></label>
              </div>
              {form.showAge && (
                <input className="field-input" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} style={{ width: 120, marginBottom: 8 }} />
              )}
              <div className="toggle-row">
                <span>Likes públicos</span>
                <label className="switch"><input type="checkbox" checked={form.showLikes} onChange={(e) => setForm({ ...form, showLikes: e.target.checked })} /><span className="slider" /></label>
              </div>
              <div className="toggle-row">
                <span>Comentarios públicos</span>
                <label className="switch"><input type="checkbox" checked={form.showComments} onChange={(e) => setForm({ ...form, showComments: e.target.checked })} /><span className="slider" /></label>
              </div>
              <div className="toggle-row">
                <span>Carpetas públicas</span>
                <label className="switch"><input type="checkbox" checked={form.showFolders} onChange={(e) => setForm({ ...form, showFolders: e.target.checked })} /><span className="slider" /></label>
              </div>
              <div className="toggle-row">
                <span>Modo oscuro</span>
                <label className="switch"><input type="checkbox" checked={theme === 'dark'} onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')} /><span className="slider" /></label>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button type="button" className="pf-btn" onClick={handleSave} disabled={saving}>{saving ? '…' : 'Guardar'}</button>
                <button type="button" className="pf-btn ghost" onClick={() => setEditMode(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <h1>{form.username || 'Usuario'}</h1>
              {form.showAge && form.age && <p className="meta">Edad: {form.age}</p>}
              <p className="bio">{form.description || 'Sin descripción todavía.'}</p>
            </>
          )}
        </div>

        <div className="pf-layout">
          <div className="pf-main">
            <div className="pf-card">
              <h2>💬 Muro</h2>
              <form onSubmit={postWall} style={{ marginBottom: 16 }}>
                {replyTo && (
                  <div className="reply-banner">
                    Respondiendo a <strong>{replyTo.profiles?.username || 'Usuario'}</strong>
                    <button type="button" onClick={() => setReplyTo(null)}>Cancelar</button>
                  </div>
                )}
                <textarea
                  className="field-textarea"
                  value={wallText}
                  onChange={(e) => setWallText(e.target.value)}
                  placeholder={replyTo ? 'Escribe tu respuesta…' : 'Escribe en tu muro…'}
                  maxLength={500}
                  disabled={posting}
                  style={{ minHeight: 70 }}
                />
                <button type="submit" className="pf-btn" disabled={posting || !wallText.trim()}>
                  {posting ? 'Enviando…' : replyTo ? 'Responder' : 'Publicar'}
                </button>
              </form>
              {wall.length === 0 && (
                <div className="wall-empty">Todavía no hay mensajes en tu muro.</div>
              )}
              {roots.map((w) => (
                <div key={w.id}>
                  <div className="wall-item">
                    <Link to={`/profiles/${w.author_id}`}>
                      <img src={w.profiles?.avatar_url || '/loguito.png'} alt="" />
                    </Link>
                    <div style={{ flex: 1 }}>
                      <div className="wall-meta">
                        <Link to={`/profiles/${w.author_id}`}>{w.profiles?.username || 'Usuario'}</Link>
                        {' · '}
                        {new Date(w.created_at).toLocaleDateString('es-ES')}
                      </div>
                      <div className="wall-text">{w.content}</div>
                      <div className="wall-actions">
                        <button type="button" onClick={() => setReplyTo(w)}>Responder</button>
                        <button type="button" className="wall-del" onClick={() => deleteWallPost(w.id)}>Borrar</button>
                      </div>
                    </div>
                  </div>
                  {repliesOf(w.id).map((r) => (
                    <div key={r.id} className="wall-item reply">
                      <Link to={`/profiles/${r.author_id}`}>
                        <img src={r.profiles?.avatar_url || '/loguito.png'} alt="" />
                      </Link>
                      <div style={{ flex: 1 }}>
                        <div className="wall-meta">
                          <Link to={`/profiles/${r.author_id}`}>{r.profiles?.username || 'Usuario'}</Link>
                          {' · '}
                          {new Date(r.created_at).toLocaleDateString('es-ES')}
                        </div>
                        <div className="wall-text">{r.content}</div>
                        <button type="button" className="wall-del" onClick={() => deleteWallPost(r.id)}>Borrar</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="pf-card">
              <h2>📁 Carpetas</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <input
                  className="field-input"
                  style={{ maxWidth: 200 }}
                  placeholder="Nombre (ej. Por leer)"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                />
                <button type="button" className="pf-btn" onClick={createFolder}>Crear</button>
              </div>
              <div>
                {folders.map((f) => (
                  <span
                    key={f.id}
                    className={`folder-chip ${activeFolder === f.id ? 'active' : ''}`}
                    onClick={() => setActiveFolder(activeFolder === f.id ? null : f.id)}
                  >
                    {f.name}
                    <button
                      type="button"
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#c0392b', fontWeight: 'bold' }}
                      onClick={(e) => { e.stopPropagation(); deleteFolder(f.id) }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {activeFolder && (
                <>
                  <div className="fav-grid">
                    {(folderItems[activeFolder] || []).map((it) => (
                      <div key={it.id}>
                        <Link to={`/comic/${it.comic_id}`}>
                          <img src={it.comics?.cover_url || '/loguito.png'} alt={it.comics?.title} />
                        </Link>
                        <button type="button" className="wall-del" onClick={() => removeFromFolder(activeFolder, it.id)}>Quitar</button>
                      </div>
                    ))}
                  </div>
                  <p className="muted" style={{ marginTop: 12 }}>Añadir arco:</p>
                  <input className="field-input" placeholder="Buscar…" value={comicSearch} onChange={(e) => setComicSearch(e.target.value)} />
                  <div className="comic-pick">
                    {filteredComics.slice(0, 25).map((c) => (
                      <button key={c.id} type="button" onClick={() => addComicToFolder(activeFolder, c.id)}>
                        {c.title}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <aside className="pf-side">
            <div className="pf-card">
              <h2>❤️ Capítulos likeados</h2>
              <div className="side-list">
                {likesCh.length === 0 && <p className="muted">Aún no hay likes.</p>}
                {likesCh.map((l) => (
                  <div key={l.id} className="side-item" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {(l.chapters as any)?.comics?.cover_url ? (
                      <img src={(l.chapters as any).comics.cover_url} alt="" style={{ width: 36, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                    ) : null}
                    <div>
                      <div className="sub">{(l.chapters as any)?.comics?.title}</div>
                      <Link to={`/comic/${l.chapters?.comic_id}/chapter/${l.chapter_id}`}>
                        Cap. {l.chapters?.number} — {l.chapters?.title}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              <h3>❤️ Comentarios likeados</h3>
              <div className="side-list">
                {likesCm.length === 0 && <p className="muted">Sin likes en comentarios.</p>}
                {likesCm.map((l) => {
                  const cm = (l as any).comments
                  const author = cm?.profiles
                  const ch = cm?.chapters
                  const comicTitle = ch?.comics?.title
                  return (
                    <div key={l.id} className="side-item" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <Link to={`/profiles/${cm?.user_id || ''}`}>
                        <img
                          src={author?.avatar_url || '/loguito.png'}
                          alt=""
                          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #FFD700' }}
                        />
                      </Link>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="sub">
                          <Link to={`/profiles/${cm?.user_id || ''}`} style={{ color: 'var(--text)' }}>
                            {author?.username || 'Usuario'}
                          </Link>
                          {' · '}
                          {comicTitle || 'Arco'} · Cap. {ch?.number}
                        </div>
                        <Link to={`/comic/${ch?.comic_id}/chapter/${cm?.chapter_id}`}>
                          {(cm?.content || 'Comentario').slice(0, 70)}…
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pf-card">
              <h2>💬 Mis comentarios</h2>
              <div className="side-list">
                {myComments.length === 0 && <p className="muted">No has comentado aún.</p>}
                {myComments.map((c) => (
                  <div key={c.id} className="side-item" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {(c.chapters as any)?.comics?.cover_url && (
                      <img src={(c.chapters as any).comics.cover_url} alt="" style={{ width: 36, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <div>
                      <div className="sub">{(c.chapters as any)?.comics?.title} · Cap. {c.chapters?.number}</div>
                      <Link to={`/comic/${c.chapters?.comic_id}/chapter/${c.chapter_id}`}>{c.content}</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Footer />

      {confirmLogout && (
        <div className="modal-overlay" onClick={() => setConfirmLogout(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>¿Cerrar sesión?</h3>
            <p className="muted">Saldrás de tu cuenta.</p>
            <div className="modal-actions">
              <button type="button" className="modal-cancel" onClick={() => setConfirmLogout(false)}>Cancelar</button>
              <button type="button" className="modal-danger" onClick={handleLogout}>Salir</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.title}</h3>
            <p className="muted">{modal.body}</p>
            <div className="modal-actions">
              <button type="button" className="modal-cancel" onClick={() => setModal(null)}>Cancelar</button>
              <button type="button" className="modal-danger" onClick={modal.onConfirm}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {showCropper && imageSrc && (
        <div className="cropper-overlay">
          <div className="cropper-modal">
            <div className="cropper-header">{cropType === 'avatar' ? 'Foto de perfil' : 'Banner'}</div>
            <div className="cropper-area">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={cropType === 'avatar' ? 1 : 4}
                cropShape={cropType === 'avatar' ? 'round' : 'rect'}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div style={{ padding: '8px 16px' }}>
              <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: '100%', accentColor: '#FFD700' }} />
            </div>
            {livePreview && (
              <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                <img
                  src={livePreview}
                  alt=""
                  style={{
                    width: cropType === 'avatar' ? 80 : 160,
                    height: cropType === 'avatar' ? 80 : 40,
                    borderRadius: cropType === 'avatar' ? '50%' : 6,
                    border: '2px solid #FFD700',
                  }}
                />
              </div>
            )}
            <div className="cropper-actions">
              <button className="btn-cancel" onClick={() => setShowCropper(false)}>Cancelar</button>
              <button className="btn-apply" onClick={handleApplyCrop} disabled={saving}>{saving ? '…' : 'Aplicar'}</button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
