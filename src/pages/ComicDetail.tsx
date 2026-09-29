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
  comments_count?: number
}

type Comic = {
  id: string
  title: string
  description: string | null
  cover_url: string | null
  genre: string | null
  status: string
  created_at?: string
}

export default function ComicDetail() {
  const { comicId } = useParams()
  const [comic, setComic] = useState<Comic | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (comicId) loadData(comicId)
  }, [comicId])

  const loadData = async (id: string) => {
    setLoading(true)
    setError('')

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase no está configurado. Revisa tu archivo .env')
      setLoading(false)
      return
    }

    try {
      const { data: comicData, error: comicErr } = await supabase
        .from('comics')
        .select('*')
        .eq('id', id)
        .single()

      if (comicErr || !comicData) {
        setError(comicErr?.message || 'Arco no encontrado')
        setLoading(false)
        return
      }

      setComic(comicData as Comic)

      // Solo capítulos publicados
      const { data: chData, error: chErr } = await supabase
        .from('chapters')
        .select('*')
        .eq('comic_id', id)
        .eq('status', 'published')
        .order('number', { ascending: false })

      if (chErr) {
        setError(chErr.message)
        setLoading(false)
        return
      }

      // Contar comentarios reales por capítulo
      const withCounts: Chapter[] = await Promise.all(
        (chData || []).map(async (ch: any) => {
          const { count } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('chapter_id', ch.id)

          return {
            ...ch,
            comments_count: count ?? 0,
          }
        })
      )

      setChapters(withCounts)
    } catch (e: any) {
      setError(e?.message || 'Error al cargar el arco')
    } finally {
      setLoading(false)
    }
  }

  const sorted = useMemo(
    () => [...chapters].sort((a, b) => b.number - a.number),
    [chapters]
  )

  const statusColor = (s: string) => {
    const lower = (s || '').toLowerCase()
    if (lower.includes('curso') || lower.includes('ongoing')) return '#35b878'
    if (lower.includes('complet') || lower.includes('completo')) return '#2864c7'
    if (lower.includes('pausa') || lower.includes('hiatus')) return '#e0a03a'
    return '#666'
  }

  if (loading) {
    return (
      <>
        <Header />
        <ProfileButton />
        <div style={{ maxWidth: 900, margin: '40px auto', padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          Cargando arco…
        </div>
        <Footer />
      </>
    )
  }

  if (error || !comic) {
    return (
      <>
        <Header />
        <ProfileButton />
        <div style={{ maxWidth: 560, margin: '40px auto', padding: 24, background: 'var(--card)', borderRadius: 14 }}>
          <h1>Arco no encontrado</h1>
          <p style={{ color: 'crimson' }}>{error || 'No existe este arco.'}</p>
          <Link to="/arcos" style={{ color: 'var(--text)', fontWeight: 'bold' }}>← Volver a Arcos</Link>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <style>{`
        .comic-page {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px 16px 48px;
        }
        .comic-hero {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 24px;
          margin-bottom: 32px;
          align-items: start;
        }
        .comic-cover {
          width: 100%;
          border-radius: 12px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.2);
          background: #222;
          object-fit: cover;
          aspect-ratio: 3/4;
        }
        .comic-meta h1 {
          margin: 0 0 8px;
          font-size: 1.9rem;
          color: var(--text);
        }
        .comic-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .badge {
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: #111;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: bold;
        }
        .badge-status {
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.35);
        }
        .badge-muted {
          background: var(--card);
          border: 1px solid #888;
          color: var(--text);
        }
        .comic-desc {
          color: var(--muted);
          line-height: 1.5;
        }
        .chapter-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .chapter-row {
          background: var(--card);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          flex-wrap: wrap;
        }
        .chapter-info {
          flex: 1;
          min-width: 180px;
        }
        .chapter-info a {
          color: var(--text);
          text-decoration: none;
          font-weight: bold;
          font-size: 1.05rem;
        }
        .chapter-info a:hover {
          color: rgb(128, 129, 212);
        }
        .chapter-date {
          color: var(--muted);
          font-size: 0.85rem;
          margin-top: 4px;
        }
        .chapter-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .action-btn {
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: bold;
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: #111;
          transition: transform 0.2s;
          text-decoration: none;
          display: inline-block;
        }
        .action-btn:hover { transform: scale(1.04); }
        .action-btn.ghost {
          background: var(--header);
          color: white;
        }
        .empty-chapters {
          text-align: center;
          padding: 32px;
          color: var(--muted);
          background: var(--card);
          border-radius: 12px;
        }
        @media (max-width: 600px) {
          .comic-hero {
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
          }
          .comic-cover { max-width: 220px; }
          .comic-badges { justify-content: center; }
        }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="comic-page">
        <div className="comic-hero">
          <img
            className="comic-cover"
            src={comic.cover_url || '/loguito.png'}
            alt={comic.title}
          />
          <div className="comic-meta">
            <h1>{comic.title}</h1>
            <div className="comic-badges">
              {comic.status && (
                <span
                  className="badge badge-status"
                  style={{ background: statusColor(comic.status) }}
                >
                  {comic.status}
                </span>
              )}
              {comic.genre && (
                <span className="badge badge-muted">{comic.genre}</span>
              )}
              <span className="badge badge-muted">{chapters.length} caps.</span>
            </div>
            <p className="comic-desc">{comic.description || 'Sin descripción.'}</p>
          </div>
        </div>

        <h2 style={{ marginBottom: 16, color: 'var(--text)' }}>Capítulos</h2>

        {sorted.length === 0 ? (
          <div className="empty-chapters">
            <p>Aún no hay capítulos publicados en este arco.</p>
          </div>
        ) : (
          <div className="chapter-list">
            {sorted.map((ch) => (
              <div key={ch.id} className="chapter-row">
                <div className="chapter-info">
                  <Link to={`/comic/${comic.id}/chapter/${ch.id}`}>
                    #{ch.number} — {ch.title}
                  </Link>
                  <div className="chapter-date">
                    {ch.published_at
                      ? new Date(ch.published_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </div>
                </div>

                <div className="chapter-actions">
                  <Link
                    to={`/comic/${comic.id}/chapter/${ch.id}#comentarios`}
                    className="action-btn ghost"
                  >
                    💬 {ch.comments_count ?? 0}
                  </Link>

                  <Link
                    to={`/comic/${comic.id}/chapter/${ch.id}`}
                    className="action-btn"
                  >
                    Leer
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </>
  )
}