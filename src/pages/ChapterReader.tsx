import { useEffect, useMemo, useState, FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { notifyCommentReply } from '../lib/notifications'
import { trackChapterView, flushPendingViews } from '../lib/offlineViews'

type Page = { id: string; image_url: string; page_number: number }
type Chapter = {
  id: string
  comic_id: string
  number: number
  title: string
  status: string
  icon_url?: string | null
}
type Comic = { id: string; title: string; is_finished?: boolean; status?: string }
type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id?: string | null
  is_disabled?: boolean
  like_count?: number
  liked_by_me?: boolean
  profiles?: { username: string | null; avatar_url?: string | null } | null
  reply_to_username?: string | null
}

function isGuestUser() {
  return localStorage.getItem('guestMode') === 'true' || !localStorage.getItem('currentUser')
}

export default function ChapterReader() {
  const { comicId, chapterId } = useParams()
  const navigate = useNavigate()
  const [comic, setComic] = useState<Comic | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [allChapters, setAllChapters] = useState<Chapter[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [myId, setMyId] = useState<string | null>(null)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [modal, setModal] = useState<{
    title: string
    body: string
    kind?: 'confirm' | 'register' | 'info'
    onConfirm?: () => void
  } | null>(null)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (comicId && chapterId) load(comicId, chapterId)
  }, [comicId, chapterId])

  // Ir a #comentarios al cargar (desde el listado de capítulos)
  useEffect(() => {
    if (loading) return
    if (window.location.hash === '#comentarios') {
      const t = setTimeout(() => {
        document.getElementById('comentarios')?.scrollIntoView({ behavior: 'smooth' })
      }, 150)
      return () => clearTimeout(t)
    }
  }, [loading, chapterId])

  const openRegisterModal = () => {
    setModal({
      title: 'Para hacer esto, debes registrarte',
      body: 'Los likes y comentarios solo están disponibles con una cuenta. Puedes seguir leyendo sin registrarte.',
      kind: 'register',
    })
  }

  const goRegister = () => {
    localStorage.removeItem('guestMode')
    setModal(null)
    navigate('/login')
  }

  const load = async (cId: string, chId: string) => {
    setLoading(true)
    setError('')
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase no configurado')
      setLoading(false)
      return
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setMyId(user?.id || null)

      const { data: comicData } = await supabase
        .from('comics')
        .select('id, title, is_finished, status')
        .eq('id', cId)
        .single()
      setComic(comicData as Comic)

      const { data: chList } = await supabase
        .from('chapters')
        .select('id, comic_id, number, title, status, icon_url')
        .eq('comic_id', cId)
        .eq('status', 'published')
        .order('number', { ascending: true })
      setAllChapters((chList as Chapter[]) || [])

      const { data: ch } = await supabase
        .from('chapters')
        .select('id, comic_id, number, title, status, icon_url')
        .eq('id', chId)
        .single()
      setChapter(ch as Chapter)



useEffect(() => {
  if (chapterId) trackChapterView(chapterId)
}, [chapterId])

useEffect(() => {
  flushPendingViews()
}, [])
      const { data: pgs } = await supabase
        .from('pages')
        .select('id, image_url, page_number')
        .eq('chapter_id', chId)
        .order('page_number', { ascending: true })
      setPages((pgs as Page[]) || [])

      try {
        await supabase.from('chapter_views').insert({
          chapter_id: chId,
          user_id: user?.id || null,
        })
        if (cId) {
          await supabase.rpc('bump_daily_stat', {
            p_comic_id: cId,
            p_chapter_id: chId,
            p_field: 'views',
          })
        }
      } catch (_) {}

      const { count, error: cntErr } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('chapter_id', chId)
      if (cntErr) console.warn('likes count:', cntErr.message)
      setLikeCount(count || 0)

      if (user) {
        const { data: myLike, error: mlErr } = await supabase
          .from('likes')
          .select('id')
          .eq('chapter_id', chId)
          .eq('user_id', user.id)
          .maybeSingle()
        if (mlErr) console.warn('my like:', mlErr.message)
        setLiked(!!myLike)
      } else {
        setLiked(false)
      }

      const { data: cms } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id, parent_id, is_disabled, profiles(username, avatar_url)')
        .eq('chapter_id', chId)
        .or('is_disabled.eq.false,is_disabled.is.null')
        .order('created_at', { ascending: true })

      const list = (cms as any[]) || []
      const byId: Record<string, any> = {}
      list.forEach((c) => {
        byId[c.id] = c
      })
      const withLikes: Comment[] = []
      for (const c of list) {
        const { count: lc } = await supabase
          .from('comment_likes')
          .select('*', { count: 'exact', head: true })
          .eq('comment_id', c.id)
        let liked_by_me = false
        if (user) {
          const { data: ml } = await supabase
            .from('comment_likes')
            .select('id')
            .eq('comment_id', c.id)
            .eq('user_id', user.id)
            .maybeSingle()
          liked_by_me = !!ml
        }
        let reply_to_username: string | null = null
        if (c.parent_id && byId[c.parent_id]?.profiles?.username) {
          reply_to_username = byId[c.parent_id].profiles.username
        }
        withLikes.push({ ...c, like_count: lc || 0, liked_by_me, reply_to_username })
      }
      setComments(withLikes)
    } catch (e: any) {
      setError(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const idx = useMemo(
    () => allChapters.findIndex((c) => c.id === chapterId),
    [allChapters, chapterId]
  )
  const prev = idx > 0 ? allChapters[idx - 1] : null
  const next = idx >= 0 && idx < allChapters.length - 1 ? allChapters[idx + 1] : null
  const isLast = idx === allChapters.length - 1 && allChapters.length > 0
  const finished = comic?.is_finished || comic?.status === 'completed'

  const toggleChapterLike = async () => {
    if (!supabase || !chapterId) {
      openRegisterModal()
      return
    }
    if (isGuestUser()) {
      openRegisterModal()
      return
    }
    if (likeBusy) return
    setLikeBusy(true)
    setError('')
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser()
      if (authErr || !user) {
        openRegisterModal()
        setLikeBusy(false)
        return
      }
      setMyId(user.id)

      if (liked) {
        const { error: delErr } = await supabase
          .from('likes')
          .delete()
          .eq('chapter_id', chapterId)
          .eq('user_id', user.id)
        if (delErr) {
          setError('No se pudo quitar el like: ' + delErr.message)
          setLikeBusy(false)
          return
        }
        setLiked(false)
        setLikeCount((n) => Math.max(0, n - 1))
      } else {
        const { error: insErr } = await supabase.from('likes').insert({
          chapter_id: chapterId,
          user_id: user.id,
        })
        if (insErr) {
          if (insErr.code === '23505' || insErr.message?.includes('duplicate')) {
            setLiked(true)
          } else {
            setError('No se pudo guardar el like: ' + insErr.message)
            setLikeBusy(false)
            return
          }
        } else {
          setLiked(true)
          setLikeCount((n) => n + 1)
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Error al guardar like')
    } finally {
      setLikeBusy(false)
    }
  }

  const toggleCommentLike = async (c: Comment) => {
    if (!supabase) return
    if (isGuestUser()) {
      openRegisterModal()
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      openRegisterModal()
      return
    }
    if (c.liked_by_me) {
      await supabase.from('comment_likes').delete().eq('comment_id', c.id).eq('user_id', user.id)
      setComments((prev) =>
        prev.map((x) =>
          x.id === c.id
            ? { ...x, liked_by_me: false, like_count: Math.max(0, (x.like_count || 1) - 1) }
            : x
        )
      )
    } else {
      const { error: insErr } = await supabase.from('comment_likes').insert({
        comment_id: c.id,
        user_id: user.id,
      })
      if (insErr && insErr.code !== '23505') {
        setError(insErr.message)
        return
      }
      setComments((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, liked_by_me: true, like_count: (x.like_count || 0) + 1 } : x
        )
      )
    }
  }

  const sendComment = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !chapterId || !text.trim()) return
    if (isGuestUser()) {
      openRegisterModal()
      return
    }
    setPosting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        openRegisterModal()
        setPosting(false)
        return
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('comment_ban_until, banned_until')
        .eq('id', user.id)
        .single()
      if (prof?.banned_until && new Date(prof.banned_until) > new Date()) {
        setError('Cuenta suspendida.')
        setPosting(false)
        return
      }
      if (prof?.comment_ban_until && new Date(prof.comment_ban_until) > new Date()) {
        setError('No puedes comentar hasta ' + new Date(prof.comment_ban_until).toLocaleString())
        setPosting(false)
        return
      }
      const payload: any = {
        chapter_id: chapterId,
        user_id: user.id,
        content: text.trim(),
      }
      if (replyTo) payload.parent_id = replyTo.id
      const { data, error: err } = await supabase
        .from('comments')
        .insert(payload)
        .select('id, content, created_at, user_id, parent_id, is_disabled, profiles(username, avatar_url)')
        .single()
      if (err) setError(err.message)
      else {
        if (replyTo?.user_id && comicId) {
          const uname =
            localStorage.getItem('username') ||
            (JSON.parse(localStorage.getItem('currentUser') || '{}') as any).username ||
            'Alguien'
          try {
            await notifyCommentReply({
              targetUserId: replyTo.user_id,
              fromUsername: uname,
              preview: text.trim(),
              chapterId,
              comicId,
            })
          } catch (_) {}
        }
        try {
          if (comicId) {
            await supabase.rpc('bump_daily_stat', {
              p_comic_id: comicId,
              p_chapter_id: chapterId,
              p_field: 'comments',
            })
          }
        } catch (_) {}
        setComments((prev) => [
          ...prev,
          {
            ...(data as any),
            like_count: 0,
            liked_by_me: false,
            reply_to_username: replyTo?.profiles?.username || null,
          },
        ])
        setText('')
        setReplyTo(null)
      }
    } finally {
      setPosting(false)
    }
  }

  const saveEdit = async (id: string) => {
    if (!supabase || !editText.trim()) return
    const { error: err } = await supabase
      .from('comments')
      .update({ content: editText.trim() })
      .eq('id', id)
    if (err) setError(err.message)
    else {
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, content: editText.trim() } : c)))
      setEditId(null)
    }
  }

  const deleteOwnComment = (c: Comment) => {
    if (!myId || c.user_id !== myId) return
    setModal({
      title: 'Borrar comentario',
      body: '¿Seguro que quieres borrar este comentario?',
      kind: 'confirm',
      onConfirm: async () => {
        if (!supabase) return
        await supabase.from('comments').delete().eq('id', c.id)
        setComments((prev) => prev.filter((x) => x.id !== c.id))
        setModal(null)
      },
    })
  }

  const NavBar = () => (
    <div className="nav-btns">
      <Link className="nav-btn" to={`/comic/${comicId}`}>
        Lista
      </Link>
      <button
        type="button"
        className="nav-btn"
        disabled={!prev}
        onClick={() => prev && navigate(`/comic/${comicId}/chapter/${prev.id}`)}
      >
        ← Anterior
      </button>
      <button
        type="button"
        className="nav-btn primary"
        disabled={!next}
        onClick={() => next && navigate(`/comic/${comicId}/chapter/${next.id}`)}
      >
        Siguiente →
      </button>
      <a className="nav-btn" href="#comentarios">
        💬 Comentarios
      </a>
      <button
        type="button"
        className={`nav-btn like-btn ${liked ? 'on' : ''}`}
        onClick={toggleChapterLike}
        disabled={likeBusy}
        aria-label="Like"
      >
        {liked ? (
          <span className="like-on-wrap">
            <span className="heart-emoji" aria-hidden>❤️</span>
            <span className="like-num">{likeCount}</span>
          </span>
        ) : (
          <>
            <span className="heart-ico">♡</span>
            <span className="like-num">{likeCount}</span>
          </>
        )}
      </button>
    </div>
  )

  if (loading) {
    return (
      <>
        <Header />
        <ProfileButton />
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Cargando…</div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <style>{`
        .reader-page {
          max-width: 820px;
          margin: 0 auto;
          padding: 16px 12px 80px;
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
        }
        .reader-top {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .reader-title {
          margin: 0;
          font-size: 1.25rem;
          color: var(--text);
        }
        .reader-sub {
          margin: 2px 0 0;
          color: var(--muted);
          font-size: 13px;
        }
        .nav-btns {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 10px 0;
        }
        .nav-btn {
          padding: 10px 14px;
          border-radius: 10px;
          border: 2px solid var(--border, #494949);
          background: var(--card);
          color: var(--text);
          font-family: inherit;
          font-weight: bold;
          cursor: pointer;
          text-decoration: none;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
        }
        .nav-btn:hover:not(:disabled) { border-color: #FFD700; }
        .nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .nav-btn.primary {
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: #111;
          border-color: #FFD700;
        }
        /* Like estilo Webtoon: fondo claro, borde rosa al activar, corazón siempre visible */
        .nav-btn.like-btn {
          background: #ffffff !important;
          color: #333 !important;
          border: 2px solid #ccc !important;
          min-width: 56px;
          justify-content: center;
        }
        .nav-btn.like-btn.on {
          border-color: #ff2d55 !important;
          background: #ffffff !important;
          color: #ff2d55 !important;
        }
        .nav-btn.like-btn .heart-ico {
          color: #888;
          font-size: 1.3em;
          font-weight: 900;
          line-height: 1;
          margin-right: 5px;
        }
        .nav-btn.like-btn.on .heart-ico {
          color: #ff2d55 !important;
        }
        .nav-btn.like-btn .like-num {
          color: inherit;
          font-weight: bold;
        }
        .nav-btn.like-btn .like-on-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .nav-btn.like-btn .heart-emoji {
          font-size: 1.15em;
          line-height: 1;
          filter: drop-shadow(0 0 1px #ff2d55);
        }

        .pages-strip {
          display: flex;
          flex-direction: column;
          background: #111;
          border-radius: 12px;
          overflow: hidden;
        }
        .pages-strip img {
          width: 100%;
          display: block;
          cursor: default;
          user-select: none;
        }
        .end-box {
          margin: 20px 0;
          padding: 20px;
          border-radius: 14px;
          text-align: center;
          background: var(--card);
          border: 2px solid #FFD700;
        }
        .comments-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 28px 0 14px;
          flex-wrap: wrap;
        }
        .comments-head h2 { margin: 0; color: var(--text); }
        .comment-form textarea {
          width: 100%;
          min-height: 80px;
          padding: 12px 14px;
          border-radius: 10px;
          border: 3px solid #494949;
          background: rgb(102,99,120);
          color: #0a0a0a;
          font-family: inherit;
          font-size: 15px;
          box-sizing: border-box;
          resize: vertical;
        }
        .comment-form button {
          margin-top: 10px;
          padding: 11px 18px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          font-family: inherit;
          font-weight: bold;
          cursor: pointer;
        }
        .comment-item {
          display: flex;
          gap: 12px;
          padding: 14px 0;
          border-top: 1px solid rgba(128,128,128,0.2);
        }
        .comment-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #FFD700;
          background: #222;
          cursor: pointer;
          flex-shrink: 0;
        }
        .comment-meta {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .comment-meta a {
          color: var(--text);
          font-weight: bold;
          text-decoration: none;
        }
        .comment-actions {
          display: flex;
          gap: 10px;
          margin-top: 6px;
          flex-wrap: wrap;
        }
        .c-like {
          border: none;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
          color: var(--muted);
          font-size: 13px;
          font-weight: bold;
          padding: 4px 8px;
          border-radius: 8px;
        }
        .c-like.on { color: #ff2d55 !important; }
        .err {
          background: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 10px;
        }
        .edit-area {
          width: 100%;
          min-height: 60px;
          padding: 10px;
          border-radius: 8px;
          border: 2px solid #FFD700;
          font-family: inherit;
          background: var(--bg);
          color: var(--text);
          box-sizing: border-box;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 2500;
          background: rgba(0,0,0,0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal-box {
          background: var(--card);
          color: var(--text);
          border: 3px solid #FFD700;
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
          width: 100%;
        }
        .modal-box h3 { margin: 0 0 10px; }
        .modal-actions { display: flex; gap: 10px; margin-top: 18px; }
        .modal-actions button {
          flex: 1;
          padding: 11px;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          font-weight: bold;
          cursor: pointer;
        }
        .modal-ok {
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: #111;
        }
        .modal-cancel { background: #666; color: #fff; }
        .modal-danger { background: #c0392b; color: #fff; }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="reader-page">
        <div className="reader-top">
          <div>
            <h1 className="reader-title">
              {chapter?.icon_url && (
                <img
                  src={chapter.icon_url}
                  alt=""
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    verticalAlign: 'middle',
                    marginRight: 8,
                    objectFit: 'cover',
                  }}
                />
              )}
              #{chapter?.number} — {chapter?.title}
            </h1>
            <p className="reader-sub">
              <Link to={`/comic/${comicId}`} style={{ color: 'var(--muted)' }}>
                {comic?.title}
              </Link>
            </p>
          </div>
        </div>

        <NavBar />
        {error && <div className="err">{error}</div>}

        <div className="pages-strip">
          {pages.map((p) => (
            <img key={p.id} src={p.image_url} alt={`Página ${p.page_number}`} draggable={false} />
          ))}
          {pages.length === 0 && (
            <p style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Sin páginas todavía.</p>
          )}
        </div>

        <NavBar />

        {isLast && (
          <div className="end-box">
            {finished ? (
              <>
                <h3 style={{ margin: '0 0 8px' }}>Has completado este arco</h3>
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  No habrá más capítulos. ¡Gracias por leer!
                </p>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 8px' }}>Próximamente</h3>
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  Este es el último capítulo publicado. Pronto habrá más.
                </p>
              </>
            )}
          </div>
        )}

        <div className="comments-head" id="comentarios">
          <h2>Comentarios ({comments.length})</h2>
        </div>

        <form className="comment-form" onSubmit={sendComment}>
          {replyTo && (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
              Respondiendo a <strong>{replyTo.profiles?.username || 'Usuario'}</strong>{' '}
              <button type="button" className="c-like" onClick={() => setReplyTo(null)}>
                Cancelar
              </button>
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              myId
                ? replyTo
                  ? 'Escribe tu respuesta…'
                  : 'Escribe un comentario…'
                : 'Inicia sesión o regístrate para comentar'
            }
            maxLength={800}
            disabled={!myId || posting}
            onFocus={() => {
              if (!myId || isGuestUser()) openRegisterModal()
            }}
          />
          <button type="submit" disabled={!myId || posting || !text.trim()}>
            {posting ? 'Enviando…' : replyTo ? 'Responder' : 'Publicar'}
          </button>
        </form>

        {comments
          .filter((c) => !c.parent_id)
          .map((c) => {
            const replies = comments.filter((r) => r.parent_id === c.id)
            const showAll = expandedReplies[c.id]
            const visibleReplies = showAll ? replies : replies.slice(0, 2)
            const renderOne = (item: Comment, isReply: boolean) => (
              <div
                key={item.id}
                className="comment-item"
                style={
                  isReply
                    ? {
                        marginLeft: 28,
                        borderLeft: '2px solid rgba(255,215,0,0.35)',
                        paddingLeft: 12,
                      }
                    : undefined
                }
              >
                <Link to={`/profiles/${item.user_id}`}>
                  <img
                    className="comment-avatar"
                    src={item.profiles?.avatar_url || '/loguito.png'}
                    alt=""
                  />
                </Link>
                <div style={{ flex: 1 }}>
                  <div className="comment-meta">
                    <Link to={`/profiles/${item.user_id}`}>
                      {item.profiles?.username || 'Usuario'}
                    </Link>
                    {' · '}
                    {new Date(item.created_at).toLocaleString('es-ES')}
                  </div>
                  {isReply && item.reply_to_username && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--muted)',
                        marginBottom: 4,
                        fontStyle: 'italic',
                      }}
                    >
                      Respuesta de {item.profiles?.username || 'Usuario'} para{' '}
                      {item.reply_to_username}
                    </div>
                  )}
                  {editId === item.id ? (
                    <>
                      <textarea
                        className="edit-area"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <div className="comment-actions">
                        <button type="button" className="c-like" onClick={() => saveEdit(item.id)}>
                          Guardar
                        </button>
                        <button type="button" className="c-like" onClick={() => setEditId(null)}>
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{item.content}</div>
                  )}
                  <div className="comment-actions">
                    <button
                      type="button"
                      className={`c-like ${item.liked_by_me ? 'on' : ''}`}
                      onClick={() => toggleCommentLike(item)}
                    >
                      <span
                        style={{
                          color: item.liked_by_me ? '#ff2d55' : '#888',
                          fontSize: '1.2em',
                          fontWeight: 900,
                          marginRight: 4,
                        }}
                      >
                        {item.liked_by_me ? '♥' : '♡'}
                      </span>
                      {item.like_count || 0}
                    </button>
                    {myId && (
                      <button
                        type="button"
                        className="c-like"
                        onClick={() => {
                          setReplyTo(item)
                          document
                            .getElementById('comentarios')
                            ?.scrollIntoView({ behavior: 'smooth' })
                        }}
                      >
                        Responder
                      </button>
                    )}
                    {myId === item.user_id && editId !== item.id && (
                      <>
                        <button
                          type="button"
                          className="c-like"
                          onClick={() => {
                            setEditId(item.id)
                            setEditText(item.content)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="c-like"
                          onClick={() => deleteOwnComment(item)}
                        >
                          Borrar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
            return (
              <div key={c.id}>
                {renderOne(c, false)}
                {visibleReplies.map((r) => renderOne(r, true))}
                {replies.length > 2 && (
                  <button
                    type="button"
                    className="c-like"
                    style={{ marginLeft: 40, marginBottom: 8 }}
                    onClick={() =>
                      setExpandedReplies((prev) => ({ ...prev, [c.id]: !showAll }))
                    }
                  >
                    {showAll ? 'Ver menos' : `Ver más (${replies.length - 2})`}
                  </button>
                )}
              </div>
            )
          })}
      </div>

      <Footer />

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.title}</h3>
            <p style={{ margin: 0, color: 'var(--muted)' }}>{modal.body}</p>
            <div className="modal-actions">
              {modal.kind === 'register' ? (
                <>
                  <button type="button" className="modal-cancel" onClick={() => setModal(null)}>
                    Seguir leyendo
                  </button>
                  <button type="button" className="modal-ok" onClick={goRegister}>
                    Registrarme
                  </button>
                </>
              ) : modal.onConfirm ? (
                <>
                  <button type="button" className="modal-cancel" onClick={() => setModal(null)}>
                    Cancelar
                  </button>
                  <button type="button" className="modal-danger" onClick={modal.onConfirm}>
                    Confirmar
                  </button>
                </>
              ) : (
                <button type="button" className="modal-ok" onClick={() => setModal(null)}>
                  Entendido
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}