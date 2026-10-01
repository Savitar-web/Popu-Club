import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type Comic = {
  id: string
  title: string
  cover_url: string | null
  genre: string | null
  status: string | null
  description?: string | null
  is_featured?: boolean
  sort_order?: number
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

export default function Arcos() {
  const [comics, setComics] = useState<Comic[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('all')
  const [status, setStatus] = useState('all')
  const [err, setErr] = useState('')

  useEffect(() => {
    load()
    const onVis = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const load = async () => {
    setLoading(true)
    setErr('')
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('comics')
      .select('id, title, cover_url, genre, status, description, is_featured, sort_order, created_at')
      .order('created_at', { ascending: false })
    if (error) setErr(error.message)
    const raw = (data as Comic[]) || []
    setComics(raw)
    console.log('[Arcos] comics loaded:', raw.length, raw.map((c) => c.title))
    setLoading(false)
  }

  const genres = useMemo(() => {
    const s = new Set<string>()
    comics.forEach((c) => {
      if (c.genre) s.add(c.genre)
    })
    return Array.from(s).sort()
  }, [comics])

  const statuses = useMemo(() => {
    const s = new Set<string>()
    comics.forEach((c) => {
      if (c.status) s.add(c.status)
    })
    return Array.from(s).sort()
  }, [comics])

  const filtered = comics.filter((c) => {
    if (genre !== 'all' && c.genre !== genre) return false
    if (status !== 'all' && c.status !== status) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!`${c.title} ${c.genre || ''} ${c.description || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <>
      <style>{`
        .arcos-page { max-width: 1100px; margin: 0 auto; padding: 20px 14px 48px; font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif; }
        .arcos-page h1 { margin: 0 0 8px; color: var(--text); }
        .filters { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0 22px; }
        .filters input, .filters select {
          flex: 1; min-width: 140px; padding: 12px 14px; border-radius: 10px;
          border: 3px solid #494949; background: rgb(102,99,120); color: #0a0a0a;
          font-family: inherit; font-size: 15px; box-sizing: border-box;
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 22px; }
        @media (max-width: 500px) { .grid { grid-template-columns: repeat(2, 1fr); gap: 14px; } }
        .card {
          text-align: center; transition: transform 0.2s; text-decoration: none; color: inherit; display: block;
        }
        .card:hover { transform: translateY(-5px); }
        .card .cover {
          width: 100%; aspect-ratio: 3/4; border-radius: 12px; overflow: hidden;
          background: #222; box-shadow: 0 8px 20px rgba(0,0,0,0.25);
        }
        .card .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .card .title { display: block; margin-top: 10px; font-weight: bold; font-size: 15px; color: var(--text); }
        .badge-row { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-top: 6px; }
        .badge-status {
          font-size: 11px; padding: 2px 8px; border-radius: 999px;
          border: 2px solid #3b82f6; color: var(--text); background: rgba(59,130,246,0.12);
        }
        .badge-genre {
          font-size: 11px; padding: 2px 8px; border-radius: 999px;
          border: 2px solid #ef4444; color: var(--text); background: rgba(239,68,68,0.1);
        }
        .empty { text-align: center; color: var(--muted); padding: 32px; }
        .err { background: #f8d7da; color: #721c24; padding: 12px; border-radius: 10px; margin-bottom: 12px; }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="arcos-page">
        <h1>Arcos</h1>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>Todos los arcos publicados ({filtered.length})</p>
        {err && <div className="err">{err}</div>}

        <div className="filters">
          <input type="text" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="all">Todos los géneros</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos los estados</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{statusEs(s)}</option>
            ))}
          </select>
        </div>

        {loading && <p className="empty">Cargando…</p>}
        {!loading && filtered.length === 0 && (
          <p className="empty">No hay arcos. Crea uno en Admin (estado ≠ Borrador).</p>
        )}

        <div className="grid">
          {filtered.map((c) => (
            <Link key={c.id} to={`/comic/${c.id}`} className="card">
              <div className="cover">
                <img src={c.cover_url || '/loguito.png'} alt={c.title} />
              </div>
              <span className="title">{c.title}</span>
              <div className="badge-row">
                {c.status && <span className="badge-status">{statusEs(c.status)}</span>}
                {c.genre && <span className="badge-genre">{c.genre}</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Footer />
    </>
  )
}