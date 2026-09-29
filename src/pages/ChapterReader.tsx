import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import { supabase, isSupabaseConfigured, getMyProfile } from '../lib/supabase'

type Page = {
  id: string
  image_url: string
  page_number: number
}

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles?: { username: string | null; avatar_url?: string | null } | null
}

export default function ChapterReader() {
  const { comicId, chapterId } = useParams()
  const [pages, setPages] = useState<Page[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [chapterTitle, setChapterTitle] = useState('')
  const [chapterNumber, setChapterNumber] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (chapterId) loadData(chapterId)
  }, [chapterId])

  useEffect(() => {
    if (window.location.hash === '#comentarios') {
      setTimeout(() => {
        document.getElementById('comentarios')?.scrollIntoView({ behavior: 'smooth' })
      }, 300)
    }
  }, [comments])

  const loadData = async (id: string) => {
    setLoading(true)
    setError('')

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase no está configurado. Revisa tu archivo .env')
      setLoading(false)
      return
    }

    try {
      // Capítulo
      const { data: ch, error: chErr } = await supabase
        .from('chapters')
        .select('id, number, title, status')
        .eq('id', id)
        .single()

      if (chErr || !ch) {
        setError(chErr?.message || 'Capítulo no encontrado')
        setLoading(false)
        return
      }

      if (ch.status !== 'published') {
        setError('Este capítulo aún no está publicado.')
        setLoading(false)
        return
      }

      setChapterTitle(ch.title)
      setChapterNumber(ch.number)

      // Páginas ordenadas
      const { data: pg, error: pgErr } = await supabase
        .from('pages')
        .select('id, image_url, page_number')
        .eq('chapter_id', id)
        .order('page_number', { ascending: true })

      if (pgErr) {
        setError(pgErr.message)
        setLoading(false)
        return
      }

      setPages((pg as Page[]) || [])

      // Comentarios reales con perfil
      const { data: cm, error: cmErr } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id, profiles(username, avatar_url)')
        .eq('chapter_id', id)
        .order('created_at', { ascending: false })

      if (cmErr) {
        console.warn('comments:', cmErr.message)
        setComments([])
      } else {
        setComments((cm as any) || [])
      }
    } catch (e: any) {
      setError(e?.message || 'Error al cargar el capítulo')
    } finally {
      setLoading(false)
    }
  }

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || !chapterId || !supabase) return

    setPosting(true)
    setMsg('')
    setError('')

    try {
      const profile = await getMyProfile()
      if (!profile) {
        setError('Debes iniciar sesión para comentar.')
        setPosting(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Sesión no válida. Vuelve a iniciar sesión.')
        setPosting(false)
        return
      }

      const { data, error: insErr } = await supabase
        .from('comments')
        .insert({
          chapter_id: chapterId,
          user_id: user.id,
          content,
        })
        .select('id, content, created_at, user_id, profiles(username, avatar_url)')
        .single()

      if (insErr) {
        setError(insErr.message)
        setPosting(false)
        return
      }

      setComments((prev) => [data as any, ...prev])
      setText('')
      setMsg('Comentario publicado')
    } catch (e: any) {
      setError(e?.message || 'No se pudo publicar el comentario')
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <ProfileButton />
        <div style={{ maxWidth: 800, margin: '40px auto', padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          Cargando capítulo…
        </div>
        <Footer />
      </>
    )
  }

  if (error && pages.length === 0) {
    return (
      <>
        <Header />
        <ProfileButton />
        <div style={{ maxWidth: 560, margin: '40px auto', padding: 24, background: 'var(--card)', borderRadius: 14 }}>
          <h1>No se pudo cargar</h1>
          <p style={{ color: 'crimson' }}>{error}</p>
          <Link to={comicId ? `/comic/${comicId}` : '/arcos'} style={{ color: 'var(--text)', fontWeight: 'bold' }}>
            ← Volver
          </Link>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <style>{`
        .reader-top {
          max-width: 800px;
          margin: 0 auto;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .reader-top a {
          color: var(--text);
          font-weight: bold;
          text-decoration: none;
        }
        .reader-top a:hover { color: rgb(128, 129, 212); }

        .reader-strip {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          background: #000;
        }
        .reader-strip img {
          width: 100%;
          height: auto;
          display: block;
          vertical-align: top;
        }

        .reader-nav {
          max-width: 800px;
          margin: 16px auto;
          padding: 0 16px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        .nav-btn {
          flex: 1;
          text-align: center;
          padding: 12px;
          border-radius: 10px;
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: #111;
          font-weight: bold;
          text-decoration: none;
          font-family: inherit;
          border: none;
          cursor: pointer;
        }

        .comments-box {
          max-width: 800px;
          margin: 24px auto 48px;
          padding: 0 16px;
        }
        .comments-box h2 {
          color: var(--text);
          border-bottom: 3px solid #FFD700;
          padding-bottom: 8px;
        }
        .comment-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        .comment-form textarea {
          min-height: 90px;
          padding: 12px;
          border-radius: 10px;
          border: 3px solid var(--border, #494949);
          background: var(--card);
          color: var(--text);
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
          resize: vertical;
        }
        .comment-form button {
          align-self: flex-end;
          padding: 10px 18px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          font-family: inherit;
          font-weight: bold;
          cursor: pointer;
        }
        .comment-form button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .comment-item {
          background: var(--card);
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          display: flex;
          gap: 12px;
        }
        .comment-item img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #FFD700;
          background: #333;
        }
        .comment-meta {
          font-size: 0.85rem;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .empty-pages {
          max-width: 800px;
          margin: 40px auto;
          padding: 40px 16px;
          text-align: center;
          color: var(--muted);
          background: var(--card);
          border-radius: 12px;
        }
        .msg {
          background: #d4edda;
          color: #155724;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 12px;
          font-size: 14px;
        }
        .err {
          background: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 12px;
          font-size: 14px;
        }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="reader-top">
        <Link to={`/comic/${comicId}`}>← Volver al arco</Link>
        <span style={{ color: 'var(--muted)' }}>
          {chapterNumber != null ? `Capítulo ${chapterNumber}` : 'Capítulo'}
          {chapterTitle ? ` — ${chapterTitle}` : ''}
        </span>
      </div>

      {pages.length === 0 ? (
        <div className="empty-pages">
          <p>Este capítulo aún no tiene páginas subidas.</p>
        </div>
      ) : (
        <div className="reader-strip">
          {pages.map((p) => (
            <img
              key={p.id}
              src={p.image_url}
              alt={`Página ${p.page_number}`}
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      )}

      <div className="reader-nav">
        <Link className="nav-btn" to={`/comic/${comicId}`}>
          Lista de capítulos
        </Link>
        <Link className="nav-btn" to={`/comic/${comicId}`}>
          Volver al arco
        </Link>
      </div>

      {/* BANDEJA DE COMENTARIOS REALES */}
      <div className="comments-box" id="comentarios">
        <h2>💬 Comentarios ({comments.length})</h2>

        {msg && <div className="msg">{msg}</div>}
        {error && <div className="err">{error}</div>}

        <form className="comment-form" onSubmit={sendComment}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe tu comentario... (necesitas iniciar sesión)"
            maxLength={500}
            disabled={posting}
          />
          <button type="submit" disabled={posting || !text.trim()}>
            {posting ? 'Publicando…' : 'Publicar'}
          </button>
        </form>

        {comments.length === 0 && (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
            Sé el primero en comentar.
          </p>
        )}

        {comments.map((c) => (
          <div key={c.id} className="comment-item">
            <img
              src={c.profiles?.avatar_url || '/loguito.png'}
              alt={c.profiles?.username || 'Usuario'}
            />
            <div>
              <div className="comment-meta">
                <strong style={{ color: 'var(--text)' }}>
                  {c.profiles?.username || 'Usuario'}
                </strong>
                {' · '}
                {new Date(c.created_at).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{c.content}</div>
            </div>
          </div>
        ))}
      </div>

      <Footer />
    </>
  )
}