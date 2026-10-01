import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type Chapter = {
  id: string
  comic_id: string
  number: number
  title: string
  status: string
  published_at: string | null
  icon_url?: string | null
  comments_count?: number
  likes_count?: number
  views_count?: number
}

type Comic = {
  id: string
  title: string
  description: string | null
  cover_url: string | null
  banner_url?: string | null
  genre: string | null
  status: string
  created_at?: string
}

function statusEs(s?: string | null) {
  const k = (s || '').toLowerCase().trim()
  if (k === 'ongoing' || k === 'en curso') return 'En curso'
  if (k === 'completed' || k === 'completo' || k === 'complete') return 'Completo'
  if (k === 'hiatus' || k === 'pausa') return 'Pausa'
  if (k === 'draft' || k === 'borrador') return 'Borrador'
  return s || '—'
}

export default function ComicDetail() {
  const { comicId } = useParams()
  const [comic, setComic] = useState<Comic | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({})
  const [totals, setTotals] = useState({ views: 0, likes: 0, comments: 0 })

  useEffect(() => {
    if (comicId) loadData(comicId)
  }, [comicId])

  const loadData = async (id: string) => {
    setLoading(true)
    setError('')
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase no configurado')
      setLoading(false)
      return
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: comicData, error: cErr } = await supabase
        .from('comics')
        .select('id, title, description, cover_url, banner_url, genre, status, created_at')
        .eq('id', id)
        .single()
      if (cErr || !comicData) {
        setError(cErr?.message || 'Arco no encontrado')
        setLoading(false)
        return
      }
      setComic(comicData as Comic)

      const { data: chs } = await supabase
        .from('chapters')
        .select('id, comic_id, number, title, status, published_at, icon_url')
        .eq('comic_id', id)
        .eq('status', 'published')
        .order('number', { ascending: true })

      const list = (chs as Chapter[]) || []
      const enriched: Chapter[] = []
      let tv = 0, tl = 0, tc = 0
      const liked: Record<string, boolean> = {}

      for (const ch of list) {
        const [{ count: cc }, { count: lc }, { count: vc }] = await Promise.all([
          supabase.from('comments').select('*', { count: 'exact', head: true }).eq('chapter_id', ch.id),
          supabase.from('likes').select('*', { count: 'exact', head: true }).eq('chapter_id', ch.id),
          supabase.from('chapter_views').select('*', { count: 'exact', head: true }).eq('chapter_id', ch.id),
        ])
        if (user) {
          const { data: ml } = await supabase
            .from('likes')
            .select('id')
            .eq('chapter_id', ch.id)
            .eq('user_id', user.id)
            .maybeSingle()
          liked[ch.id] = !!ml
        }
        const row = {
          ...ch,
          comments_count: cc || 0,
          likes_count: lc || 0,
          views_count: vc || 0,
        }
        enriched.push(row)
        tv += row.views_count || 0
        tl += row.likes_count || 0
        tc += row.comments_count || 0
      }
      setChapters(enriched)
      setLikedMap(liked)
      setTotals({ views: tv, likes: tl, comments: tc })
    } catch (e: any) {
      setError(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const toggleLike = async (ch: Chapter) => {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Inicia sesión para dar like')
      return
    }
    const isLiked = likedMap[ch.id]
    if (isLiked) {
      await supabase.from('likes').delete().eq('chapter_id', ch.id).eq('user_id', user.id)
      setLikedMap((m) => ({ ...m, [ch.id]: false }))
      setChapters((prev) =>
        prev.map((c) => c.id === ch.id ? { ...c, likes_count: Math.max(0, (c.likes_count || 1) - 1) } : c)
      )
      setTotals((t) => ({ ...t, likes: Math.max(0, t.likes - 1) }))
    } else {
      const { error: insErr } = await supabase.from('likes').insert({ chapter_id: ch.id, user_id: user.id })
      if (insErr && insErr.code !== '23505') {
        setError(insErr.message)
        return
      }
      setLikedMap((m) => ({ ...m, [ch.id]: true }))
      setChapters((prev) =>
        prev.map((c) => c.id === ch.id ? { ...c, likes_count: (c.likes_count || 0) + 1 } : c)
      )
      setTotals((t) => ({ ...t, likes: t.likes + 1 }))
    }
  }

  const sorted = useMemo(() => [...chapters].sort((a, b) => a.number - b.number), [chapters])

  if (loading) {
    return (
      <>
        <Header /><ProfileButton />
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Cargando…</div>
        <Footer />
      </>
    )
  }

  if (error && !comic) {
    return (
      <>
        <Header /><ProfileButton />
        <div style={{ maxWidth: 560, margin: '40px auto', padding: 24, background: 'var(--card)', borderRadius: 14 }}>
          <h1>Arco</h1>
          <p style={{ color: 'crimson' }}>{error}</p>
          <Link to="/arcos">Volver a Arcos</Link>
        </div>
        <Footer />
      </>
    )
  }

  if (!comic) return null

  return (
    <>
      <style>{`
        .comic-page { max-width: 900px; margin: 0 auto; padding: 24px 16px 48px; font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif; }
        .comic-banner {
          width: 100%; height: 200px; border-radius: 14px;
          background: linear-gradient(135deg, #333, #555); background-size: cover; background-position: center;
          margin-bottom: 24px; box-shadow: 0 8px 20px rgba(0,0,0,0.2); cursor: zoom-in;
        }
        .comic-hero { display: grid; grid-template-columns: 180px 1fr; gap: 24px; margin-bottom: 24px; align-items: start; }
        .comic-cover {
          width: 100%; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.2);
          background: #222; object-fit: cover; aspect-ratio: 3/4; cursor: zoom-in;
        }
        .comic-meta h1 { margin: 0 0 8px; font-size: 1.9rem; color: var(--text); }
        .comic-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .badge { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: bold; }
        .badge-status { border: 2px solid #3b82f6; background: rgba(59,130,246,0.12); color: var(--text); }
        .badge-genre { border: 2px solid #ef4444; background: rgba(239,68,68,0.1); color: var(--text); }
        .badge-stat { border: 2px solid #FFD700; background: rgba(255,215,0,0.12); color: var(--text); }
        .comic-desc { color: var(--muted); line-height: 1.5; margin: 0; }
        .stats-bar {
          display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px;
          padding: 14px 16px; background: var(--card); border-radius: 12px;
        }
        .stats-bar span { font-weight: bold; color: var(--text); font-size: 14px; }
        .stats-bar .pink { color: #ff4d6d; }
        .chapter-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 14px 10px; border-top: 1px solid rgba(128,128,128,0.2); flex-wrap: wrap;
        }
        .chapter-info { display: flex; gap: 12px; align-items: center; flex: 1; min-width: 180px; }
        .ch-icon {
          width: 44px; height: 44px; border-radius: 10px; object-fit: cover;
          border: 2px solid #FFD700; background: #222; flex-shrink: 0;
        }
        .chapter-info a { color: var(--text); font-weight: bold; text-decoration: none; }
        .chapter-date { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .chapter-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .action-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 12px; border-radius: 8px; border: none;
          background: linear-gradient(135deg, #FFFF00, #FFD700); color: #111;
          font-family: inherit; font-weight: bold; font-size: 13px; cursor: pointer; text-decoration: none;
        }
        .action-btn.ghost { background: var(--card); color: var(--text); border: 2px solid var(--border, #494949); }
        .heart-pink { color: #ff4d6d; }
        .empty-chapters { text-align: center; padding: 32px; color: var(--muted); background: var(--card); border-radius: 12px; }
        .err { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px; margin-bottom: 12px; }
        @media (max-width: 600px) {
          .comic-hero { grid-template-columns: 1fr; justify-items: center; text-align: center; }
          .comic-cover { max-width: 220px; }
          .comic-badges { justify-content: center; }
        }
        .heart-pink, .heart.pink, span.heart-pink, .like-btn.on .heart,
        .nav-btn.like-btn.on .heart, .action-btn .heart-pink {
          color: #ff2d55 !important;
        }
        .c-like.on { color: #ff2d55 !important; }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="comic-page">
        {error && <div className="err">{error}</div>}

        {comic.banner_url && (
          <div
            className="comic-banner"
            style={{ backgroundImage: `url(${comic.banner_url})` }}
            onClick={() => setLightbox(comic.banner_url!)}
          />
        )}

        <div className="comic-hero">
          <img
            className="comic-cover"
            src={comic.cover_url || '/loguito.png'}
            alt={comic.title}
            onClick={() => comic.cover_url && setLightbox(comic.cover_url)}
          />
          <div className="comic-meta">
            <h1>{comic.title}</h1>
            <div className="comic-badges">
              {comic.status && <span className="badge badge-status">{statusEs(comic.status)}</span>}
              {comic.genre && <span className="badge badge-genre">{comic.genre}</span>}
              <span className="badge badge-stat">{chapters.length} caps.</span>
            </div>
            <p className="comic-desc">{comic.description || 'Sin descripción.'}</p>
          </div>
        </div>

        <div className="stats-bar">
          <span>👁 {totals.views} vistas</span>
          <span className="pink">♥ {totals.likes} likes</span>
          <span>💬 {totals.comments} comentarios</span>
        </div>

        <h2 style={{ marginBottom: 16, color: 'var(--text)' }}>Capítulos</h2>

        {sorted.length === 0 ? (
          <div className="empty-chapters"><p>Aún no hay capítulos publicados en este arco.</p></div>
        ) : (
          <div>
            {sorted.map((ch) => (
              <div key={ch.id} className="chapter-row">
                <div className="chapter-info">
                  {ch.icon_url ? (
                    <img src={ch.icon_url} alt="" className="ch-icon" />
                  ) : (
                    <span className="ch-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontWeight: 'bold', fontSize: 12 }}>
                      #{ch.number}
                    </span>
                  )}
                  <div>
                    <Link to={`/comic/${comic.id}/chapter/${ch.id}`}>
                      #{ch.number} — {ch.title}
                    </Link>
                    <div className="chapter-date">
                      {ch.published_at
                        ? new Date(ch.published_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                      {' · '}👁 {ch.views_count ?? 0}
                    </div>
                  </div>
                </div>
                <div className="chapter-actions">
                  <button
                    type="button"
                    className="action-btn ghost"
                    onClick={() => toggleLike(ch)}
                    style={likedMap[ch.id] ? { borderColor: '#ff2d55' } : undefined}
                  >
                    <span
                      style={{
                        color: likedMap[ch.id] ? '#ff2d55' : '#888',
                        WebkitTextFillColor: likedMap[ch.id] ? '#ff2d55' : '#888',
                        fontSize: '1.25em',
                        fontWeight: 900,
                        marginRight: 4,
                        lineHeight: 1,
                      }}
                    >
                      {likedMap[ch.id] ? '♥' : '♡'}
                    </span>
                    {ch.likes_count ?? 0}
                  </button>
                  <Link to={`/comic/${comic.id}/chapter/${ch.id}#comentarios`} className="action-btn ghost">
                    💬 {ch.comments_count ?? 0}
                  </Link>
                  <Link to={`/comic/${comic.id}/chapter/${ch.id}`} className="action-btn">Leer</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
          }}
        >
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}

      <Footer />
    </>
  )
}