import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type Comic = {
  id: string
  title: string
  cover_url: string | null
  banner_url?: string | null
  genre: string | null
  status: string | null
  is_featured?: boolean
  sort_order?: number
  created_at?: string
}
type Slide = { id: string; image_url: string; sort_order: number; is_active?: boolean }

function statusEs(s?: string | null) {
  const k = (s || '').toLowerCase().trim()
  if (k === 'ongoing' || k === 'en curso') return 'En curso'
  if (k === 'completed' || k === 'completo' || k === 'complete') return 'Completo'
  if (k === 'hiatus' || k === 'pausa') return 'Pausa'
  if (k === 'draft' || k === 'borrador') return 'Borrador'
  return s || '—'
}

export default function Home() {
  const [featured, setFeatured] = useState<Comic[]>([])
  const [recent, setRecent] = useState<Comic[]>([])
  const [slides, setSlides] = useState<Slide[]>([])
  const [sliderOn, setSliderOn] = useState(true)
  const [slideIdx, setSlideIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [err, setErr] = useState('')
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    load()
    const onVis = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (!slides.length || !sliderOn || fullscreen) return
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % slides.length), 5500)
    return () => clearInterval(t)
  }, [slides, sliderOn, fullscreen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false)
      if (e.key === 'ArrowLeft') prevSlide()
      if (e.key === 'ArrowRight') nextSlide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen, slides.length])

  const load = async () => {
    setLoading(true)
    setErr('')
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    try {
      const { data: all, error } = await supabase
        .from('comics')
        .select('id, title, cover_url, banner_url, genre, status, is_featured, sort_order, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        setErr(error.message)
        console.warn('comics load:', error)
      }

      const list = (all as Comic[]) || []
      // TODOS los arcos de la base de datos (sin filtrar por status)
      setFeatured(
        list
          .filter((c) => !!c.is_featured)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      )
      setRecent(list)
      console.log('[Home] comics loaded:', list.length, list.map((c) => c.title))

      const { data: settings } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'slider')
        .maybeSingle()
      setSliderOn(settings?.value?.enabled !== false)

      const { data: sli } = await supabase
        .from('slider_images')
        .select('id, image_url, sort_order, is_active')
        .order('sort_order', { ascending: true })
      setSlides(((sli as Slide[]) || []).filter((s) => s.is_active !== false))
    } finally {
      setLoading(false)
    }
  }

  const prevSlide = () => {
    if (slides.length) setSlideIdx((i) => (i - 1 + slides.length) % slides.length)
  }
  const nextSlide = () => {
    if (slides.length) setSlideIdx((i) => (i + 1) % slides.length)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 40) return
    if (dx > 0) prevSlide()
    else nextSlide()
  }

  return (
    <>
      <style>{`
        .home-page { max-width: 1100px; margin: 0 auto; padding: 16px 14px 48px; font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif; }
        .slider-wrap {
          position: relative; border-radius: 16px; overflow: hidden;
          aspect-ratio: 21/9; background: #1a1a1a; margin-bottom: 28px;
          cursor: pointer; touch-action: pan-y;
        }
        .slider-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
        .slider-arrow {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 4;
          width: 44px; height: 44px; border-radius: 50%; border: 2px solid #FFD700;
          background: rgba(0,0,0,0.55); color: #FFD700; font-size: 24px; font-weight: bold;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .slider-arrow.left { left: 12px; } .slider-arrow.right { right: 12px; }
        .slider-dots { position: absolute; bottom: 14px; left: 0; right: 0; display: flex; justify-content: center; gap: 8px; z-index: 4; }
        .slider-dots button { width: 11px; height: 11px; border-radius: 50%; border: none; background: rgba(255,255,255,0.45); cursor: pointer; padding: 0; }
        .slider-dots button.on { background: #FFD700; }
        .section-title { margin: 0 0 16px; font-size: 1.45rem; color: var(--text); border-bottom: 3px solid #FFD700; padding-bottom: 8px; }
        .featured-banner { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 32px; }
        @media (max-width: 720px) {
          .featured-banner { grid-template-columns: 1fr; }
          .slider-wrap { aspect-ratio: 16/9; }
        }
        .feat-item {
          position: relative; border-radius: 14px; overflow: hidden; min-height: 170px;
          text-decoration: none; color: #fff; box-shadow: 0 8px 22px rgba(0,0,0,0.28);
        }
        .feat-item img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
        .feat-item .overlay {
          position: relative; z-index: 1; padding: 20px;
          background: linear-gradient(transparent 30%, rgba(0,0,0,0.8));
          min-height: 170px; display: flex; flex-direction: column; justify-content: flex-end;
        }
        .feat-item h3 { margin: 0 0 4px; font-size: 1.15rem; }
        .feat-item p { margin: 0; font-size: 12px; opacity: 0.9; }
        .recent-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 22px; margin-bottom: 36px;
        }
        @media (max-width: 560px) { .recent-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; } }
        .recent-card { text-align: center; transition: transform 0.2s; text-decoration: none; color: inherit; display: block; }
        .recent-card:hover { transform: translateY(-6px); }
        .recent-card .cover-box {
          width: 100%; aspect-ratio: 3/4; border-radius: 10px; overflow: hidden;
          background: #1a1a1a; box-shadow: 0 10px 24px rgba(0,0,0,0.28);
        }
        .recent-card .cover-box img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .recent-card .title { display: block; margin-top: 10px; font-weight: bold; font-size: 15px; color: var(--text); }
        .badge-row { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-top: 6px; }
        .badge-status {
          font-size: 11px; padding: 2px 8px; border-radius: 999px;
          border: 2px solid #3b82f6; color: var(--text); background: rgba(59,130,246,0.12);
        }
        .badge-genre {
          font-size: 11px; padding: 2px 8px; border-radius: 999px;
          border: 2px solid #ef4444; color: var(--text); background: rgba(239,68,68,0.1);
        }
        .empty { text-align: center; color: var(--muted); padding: 28px; }
        .err { background: #f8d7da; color: #721c24; padding: 12px; border-radius: 10px; margin-bottom: 12px; }
        .fs-overlay {
          position: fixed; inset: 0; z-index: 4000; background: rgba(0,0,0,0.94);
          display: flex; align-items: center; justify-content: center;
        }
        .fs-overlay img { max-width: min(96vw, 1200px); max-height: 92vh; object-fit: contain; }
        .fs-nav {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 5;
          width: 48px; height: 48px; border-radius: 50%; border: 2px solid #FFD700;
          background: rgba(0,0,0,0.5); color: #FFD700; font-size: 26px; cursor: pointer;
        }
        .fs-nav.left { left: 16px; } .fs-nav.right { right: 16px; }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="home-page">
        {err && <div className="err">Error cargando arcos: {err}</div>}

        {sliderOn && slides.length > 0 && (
          <div className="slider-wrap" onClick={() => setFullscreen(true)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <img src={slides[slideIdx]?.image_url} alt="" />
            <button type="button" className="slider-arrow left" onClick={(e) => { e.stopPropagation(); prevSlide() }}>‹</button>
            <button type="button" className="slider-arrow right" onClick={(e) => { e.stopPropagation(); nextSlide() }}>›</button>
            <div className="slider-dots" onClick={(e) => e.stopPropagation()}>
              {slides.map((s, i) => (
                <button key={s.id} type="button" className={i === slideIdx ? 'on' : ''} onClick={() => setSlideIdx(i)} />
              ))}
            </div>
          </div>
        )}

        {loading && <p className="empty">Cargando…</p>}

        {!loading && featured.length > 0 && (
          <>
            <h2 className="section-title">⭐ Principales</h2>
            <div className="featured-banner">
              {featured.map((c) => (
                <Link key={c.id} to={`/comic/${c.id}`} className="feat-item">
                  <img src={c.banner_url || c.cover_url || '/loguito.png'} alt={c.title} />
                  <div className="overlay">
                    <h3>{c.title}</h3>
                    <p>{c.genre ? c.genre : statusEs(c.status)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <h2 className="section-title">📚 Recientes ({recent.length})</h2>
        {!loading && recent.length === 0 && (
          <p className="empty">No hay arcos. Ejecuta FIX-LIKES-FINAL.sql y usa estado distinto de Borrador.</p>
        )}
        <div className="recent-grid">
          {recent.map((c) => (
            <Link key={c.id} to={`/comic/${c.id}`} className="recent-card">
              <div className="cover-box">
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

      {fullscreen && slides.length > 0 && (
        <div className="fs-overlay" onClick={() => setFullscreen(false)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <button type="button" className="fs-nav left" onClick={(e) => { e.stopPropagation(); prevSlide() }}>‹</button>
          <button type="button" className="fs-nav right" onClick={(e) => { e.stopPropagation(); nextSlide() }}>›</button>
          <img src={slides[slideIdx]?.image_url} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}