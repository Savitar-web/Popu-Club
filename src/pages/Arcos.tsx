import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type Comic = {
  id: string
  title: string
  description: string | null
  cover_url: string | null
  genre: string | null
  status: string
  created_at?: string
  chapters_count?: number
}

export default function Arcos() {
  const [comics, setComics] = useState<Comic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('Todos')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<'title' | 'newest'>('newest')

  useEffect(() => {
    loadComics()
  }, [])

  const loadComics = async () => {
    setLoading(true)
    setError('')

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase no está configurado. Revisa tu archivo .env')
      setLoading(false)
      return
    }

    try {
      // Solo arcos que no estén en borrador
      const { data, error: err } = await supabase
        .from('comics')
        .select('*')
        .neq('status', 'draft')
        .order('created_at', { ascending: false })

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      // Contar capítulos publicados por arco
      const comicsWithCount: Comic[] = await Promise.all(
        (data || []).map(async (c: any) => {
          const { count } = await supabase
            .from('chapters')
            .select('*', { count: 'exact', head: true })
            .eq('comic_id', c.id)
            .eq('status', 'published')

          return {
            ...c,
            chapters_count: count ?? 0,
          }
        })
      )

      setComics(comicsWithCount)
    } catch (e: any) {
      setError(e?.message || 'Error al cargar los arcos')
    } finally {
      setLoading(false)
    }
  }

  // Géneros y estados únicos desde la BD (los pone el admin)
  const availableGenres = useMemo(() => {
    const set = new Set<string>()
    comics.forEach((c) => {
      if (c.genre?.trim()) set.add(c.genre.trim())
    })
    return ['Todos', ...Array.from(set).sort()]
  }, [comics])

  const availableStatuses = useMemo(() => {
    const set = new Set<string>()
    comics.forEach((c) => {
      if (c.status?.trim()) set.add(c.status.trim())
    })
    return Array.from(set).sort()
  }, [comics])

  const filtered = useMemo(() => {
    let list = [...comics]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          (c.genre || '').toLowerCase().includes(q)
      )
    }

    if (genre !== 'Todos') {
      list = list.filter((c) => (c.genre || '').trim() === genre)
    }

    if (status !== 'all') {
      list = list.filter((c) => (c.status || '').trim() === status)
    }

    list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'es')
      // newest
      return (b.created_at || '').localeCompare(a.created_at || '')
    })

    return list
  }, [comics, search, genre, status, sort])

  const statusColor = (s: string) => {
    const lower = (s || '').toLowerCase()
    if (lower.includes('curso') || lower.includes('ongoing')) return '#35b878'
    if (lower.includes('complet') || lower.includes('completo')) return '#2864c7'
    if (lower.includes('pausa') || lower.includes('hiatus')) return '#e0a03a'
    return '#666'
  }

  return (
    <>
      <style>{`
        .arcos-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px 16px 48px;
        }

        .arcos-hero {
          text-align: center;
          margin-bottom: 28px;
        }

        .arcos-hero h1 {
          margin: 0 0 8px 0;
          font-size: 2.2rem;
          color: var(--text);
        }

        .arcos-hero p {
          margin: 0;
          color: var(--muted);
          font-size: 1.05rem;
        }

        .arcos-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          padding: 16px;
          background: var(--card);
          border-radius: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .search-box {
          flex: 1;
          min-width: 200px;
          position: relative;
        }

        .search-box input {
          width: 100%;
          padding: 11px 14px 11px 40px;
          border: 3px solid var(--border);
          border-radius: 10px;
          background: var(--bg);
          color: var(--text);
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-box input:focus {
          border-color: #FFD700;
          box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.25);
        }

        .search-box::before {
          content: '🔍';
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 15px;
          pointer-events: none;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .filter-chip {
          padding: 8px 14px;
          border-radius: 999px;
          border: 2px solid var(--border);
          background: transparent;
          color: var(--text);
          font-family: inherit;
          font-size: 13px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-chip:hover {
          border-color: #FFD700;
          background: rgba(255, 215, 0, 0.12);
        }

        .filter-chip.active {
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          border-color: #FFD700;
          color: #111;
        }

        .sort-select {
          padding: 8px 12px;
          border: 2px solid var(--border);
          border-radius: 8px;
          background: var(--bg);
          color: var(--text);
          font-family: inherit;
          font-size: 13px;
          cursor: pointer;
        }

        .results-count {
          margin-bottom: 16px;
          color: var(--muted);
          font-size: 0.95rem;
        }

        .comics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 22px;
        }

        .comic-card {
          background: var(--card);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 6px 16px rgba(0,0,0,0.12);
          transition: transform 0.3s, box-shadow 0.3s;
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: column;
        }

        .comic-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 14px 28px rgba(0,0,0,0.22);
        }

        .comic-cover {
          position: relative;
          aspect-ratio: 3 / 4;
          overflow: hidden;
          background: #222;
        }

        .comic-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }

        .comic-card:hover .comic-cover img {
          transform: scale(1.06);
        }

        .comic-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: bold;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
        }

        .comic-info {
          padding: 14px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .comic-info h3 {
          margin: 0 0 6px 0;
          font-size: 1.15rem;
          color: var(--text);
        }

        .comic-info p {
          margin: 0 0 10px 0;
          font-size: 0.88rem;
          color: var(--muted);
          line-height: 1.4;
          flex: 1;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .comic-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.82rem;
          color: var(--muted);
        }

        .comic-genre {
          background: rgba(255, 215, 0, 0.18);
          color: var(--text);
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 11px;
        }

        .empty-state, .loading-state, .error-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--muted);
        }

        .empty-state h3, .error-state h3 {
          margin: 0 0 8px 0;
          color: var(--text);
        }

        .error-state {
          color: #c0392b;
        }

        @media (max-width: 600px) {
          .arcos-hero h1 { font-size: 1.7rem; }
          .comics-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 14px;
          }
          .comic-info h3 { font-size: 1rem; }
        }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="arcos-page">
        <div className="arcos-hero">
          <h1>Explorar Arcos</h1>
          <p>Descubre todas las historias del universo Popu-Club</p>
        </div>

        <div className="arcos-toolbar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Buscar cómic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filters">
            {availableGenres.map((g) => (
              <button
                key={g}
                type="button"
                className={`filter-chip ${genre === g ? 'active' : ''}`}
                onClick={() => setGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="filters">
            <button
              type="button"
              className={`filter-chip ${status === 'all' ? 'active' : ''}`}
              onClick={() => setStatus('all')}
            >
              Todos
            </button>
            {availableStatuses.map((s) => (
              <button
                key={s}
                type="button"
                className={`filter-chip ${status === s ? 'active' : ''}`}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <select
            className="sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as 'title' | 'newest')}
          >
            <option value="newest">Más recientes</option>
            <option value="title">Ordenar: Título</option>
          </select>
        </div>

        {loading && (
          <div className="loading-state">
            <p>Cargando arcos…</p>
          </div>
        )}

        {error && !loading && (
          <div className="error-state">
            <h3>Error</h3>
            <p>{error}</p>
            <button type="button" className="filter-chip" onClick={loadComics} style={{ marginTop: 12 }}>
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="results-count">
              {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
            </p>

            {filtered.length === 0 ? (
              <div className="empty-state">
                <h3>No se encontraron cómics</h3>
                <p>Prueba con otros filtros o limpia la búsqueda. Si eres admin, crea arcos desde el panel.</p>
              </div>
            ) : (
              <div className="comics-grid">
                {filtered.map((comic) => (
                  <Link
                    key={comic.id}
                    to={`/comic/${comic.id}`}
                    className="comic-card"
                  >
                    <div className="comic-cover">
                      <img
                        src={comic.cover_url || '/loguito.png'}
                        alt={comic.title}
                        loading="lazy"
                      />
                      {comic.status && (
                        <span
                          className="comic-badge"
                          style={{ background: statusColor(comic.status) }}
                        >
                          {comic.status}
                        </span>
                      )}
                    </div>
                    <div className="comic-info">
                      <h3>{comic.title}</h3>
                      <p>{comic.description || 'Sin descripción'}</p>
                      <div className="comic-meta">
                        {comic.genre ? (
                          <span className="comic-genre">{comic.genre}</span>
                        ) : (
                          <span />
                        )}
                        <span>{comic.chapters_count ?? 0} caps.</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </>
  )
}