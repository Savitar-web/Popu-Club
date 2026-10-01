import { useEffect, useState, FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function Profiles() {
  const { userId } = useParams()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [myId, setMyId] = useState<string | null>(null)
  const [wall, setWall] = useState<any[]>([])
  const [wallText, setWallText] = useState('')
  const [posting, setPosting] = useState(false)
  const [likesCh, setLikesCh] = useState<any[]>([])
  const [likesCm, setLikesCm] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [folderItems, setFolderItems] = useState<Record<string, any[]>>({})
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [comicsList, setComicsList] = useState<any[]>([])

  useEffect(() => {
    if (userId) load(userId)
  }, [userId])

  const load = async (id: string) => {
    setLoading(true)
    setError('')
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase no configurado')
      setLoading(false)
      return
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setMyId(user?.id || null)

      const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (pErr || !p) {
        setError(pErr?.message || 'Perfil no encontrado')
        setLoading(false)
        return
      }
      setProfile(p)

      const { data: wallRaw } = await supabase
        .from('profile_wall')
        .select('id, content, created_at, author_id, is_disabled')
        .eq('profile_id', id)
        .or('is_disabled.eq.false,is_disabled.is.null')
        .order('created_at', { ascending: false })
        .limit(50)

      const posts = wallRaw || []
      const authorIds = [...new Set(posts.map((x: any) => x.author_id).filter(Boolean))]
      const authors: Record<string, any> = {}
      if (authorIds.length) {
        const { data: aps } = await supabase.from('profiles').select('id, username, avatar_url').in('id', authorIds)
        ;(aps || []).forEach((a: any) => { authors[a.id] = a })
      }
      setWall(posts.map((w: any) => ({ ...w, profiles: authors[w.author_id] || null })))

      if (p.show_likes !== false) {
        const { data: lk } = await supabase
          .from('likes')
          .select('id, created_at, chapter_id, chapters(title, number, comic_id, icon_url, comics(title, cover_url))')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(30)
        setLikesCh(lk || [])
        const { data: clk } = await supabase
          .from('comment_likes')
          .select('id, created_at, comment_id, comments(content, chapter_id, chapters(title, number, comic_id, comics(title)))')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(30)
        setLikesCm(clk || [])
      }

      if (p.show_comments !== false) {
        const { data: cm } = await supabase
          .from('comments')
          .select('id, content, created_at, chapter_id, chapters(title, number, comic_id, comics(title, cover_url))')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(30)
        setComments(cm || [])
      }

      if (p.show_folders !== false) {
        const { data: fd } = await supabase.from('favorite_folders').select('*').eq('user_id', id).order('created_at')
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
      }

      if (p.role === 'admin') {
        const { data: arcs } = await supabase
          .from('comics')
          .select('id, title, cover_url, status, genre')
          .neq('status', 'draft')
          .order('title')
        setComicsList(arcs || [])
      }
    } catch (e: any) {
      setError(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const postWall = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !myId || !userId || !wallText.trim()) return
    setPosting(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('profile_wall')
        .insert({ profile_id: userId, author_id: myId, content: wallText.trim() })
        .select('id, content, created_at, author_id, is_disabled')
        .single()
      if (err) {
        setError(err.message + ' — Ejecuta FIX-WALL-USERS.sql')
        return
      }
      const { data: me } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', myId).single()
      setWall((prev) => [{ ...data, profiles: me }, ...prev])
      setWallText('')
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header /><ProfileButton />
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Cargando perfil…</div>
        <Footer />
      </>
    )
  }

  if (!profile) {
    return (
      <>
        <Header /><ProfileButton />
        <div style={{ maxWidth: 480, margin: '40px auto', padding: 24, background: 'var(--card)', borderRadius: 14 }}>
          <h1>Perfil</h1>
          <p style={{ color: 'crimson' }}>{error || 'No encontrado'}</p>
          <Link to="/home">Volver</Link>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <style>{`
        .pf { max-width: 1080px; margin: 0 auto; padding: 0 16px 48px; font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif; }
        .pf-hero {
          position: relative; margin: 0 -16px 0; height: 220px;
          background: linear-gradient(135deg, #2a2a2a, #444); background-size: cover; background-position: center;
          cursor: zoom-in;
        }
        .pf-hero::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.55), transparent 50%); pointer-events: none;
        }
        .pf-hero-inner { max-width: 1080px; margin: 0 auto; padding: 0 16px; position: relative; height: 100%; }
        .pf-avatar {
          position: absolute; left: 16px; bottom: -48px; width: 112px; height: 112px;
          border-radius: 50%; border: 4px solid var(--card, #fff); object-fit: cover;
          background: #222; box-shadow: 0 8px 24px rgba(0,0,0,0.35); z-index: 2; cursor: zoom-in;
        }
        .pf-identity { margin-top: 60px; margin-bottom: 22px; padding-left: 4px; }
        .pf-identity h1 { margin: 0 0 6px; font-size: 1.75rem; color: var(--text); }
        .pf-identity .meta { margin: 0; color: var(--muted); font-size: 14px; }
        .pf-identity .bio { margin: 10px 0 0; color: var(--text); white-space: pre-wrap; line-height: 1.45; max-width: 640px; }
        .pf-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
        @media (max-width: 860px) {
          .pf-layout { grid-template-columns: 1fr; }
          .pf-side { order: 2; } .pf-main { order: 1; }
        }
        .pf-card {
          background: var(--card); border-radius: 16px; padding: 18px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.08); margin-bottom: 16px;
        }
        .pf-card h2 {
          margin: 0 0 14px; font-size: 1.05rem; color: var(--text);
          padding-bottom: 10px; border-bottom: 2px solid #FFD700;
        }
        .pf-card h3 { margin: 16px 0 10px; font-size: 0.95rem; color: var(--muted); }
        .wall-item { display: flex; gap: 12px; padding: 14px 0; border-top: 1px solid rgba(128,128,128,0.18); }
        .wall-item:first-of-type { border-top: none; }
        .wall-item img { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 2px solid #FFD700; flex-shrink: 0; }
        .wall-meta { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
        .wall-meta a { color: var(--text); font-weight: bold; text-decoration: none; }
        .wall-text { color: var(--text); white-space: pre-wrap; line-height: 1.4; font-size: 14px; }
        .field-textarea {
          width: 100%; min-height: 80px; padding: 12px 14px; border-radius: 10px;
          border: 3px solid #494949; background: rgb(102,99,120); color: #0a0a0a;
          font-family: inherit; font-size: 15px; box-sizing: border-box; resize: vertical;
        }
        .pf-btn {
          padding: 10px 18px; border: none; border-radius: 10px;
          background: linear-gradient(135deg, #FFFF00, #FFD700); color: #111;
          font-family: inherit; font-weight: bold; cursor: pointer; margin-top: 10px;
        }
        .side-list { max-height: 240px; overflow-y: auto; }
        .side-item { padding: 10px 0; border-top: 1px solid rgba(128,128,128,0.15); font-size: 13px; }
        .side-item:first-child { border-top: none; }
        .side-item a { color: var(--text); text-decoration: none; font-weight: bold; }
        .side-item .sub { font-size: 11px; color: var(--muted); margin-bottom: 2px; }
        .folder-chip {
          display: inline-block; padding: 7px 12px; margin: 3px; border-radius: 999px;
          border: 2px solid var(--border, #494949); cursor: pointer; font-weight: bold; font-size: 12px; color: var(--text);
        }
        .folder-chip.active { background: linear-gradient(135deg, #FFFF00, #FFD700); color: #111; border-color: #FFD700; }
        .fav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 10px; margin-top: 12px; }
        .fav-grid img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 8px; }
        .muted { color: var(--muted); font-size: 13px; }
        .err { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px; margin-bottom: 12px; }
        .arc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
        .arc-grid a { text-decoration: none; color: var(--text); text-align: center; font-size: 12px; font-weight: bold; }
        .arc-grid img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 8px; margin-bottom: 4px; }
        .lightbox {
          position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,0.92);
          display: flex; align-items: center; justify-content: center; cursor: zoom-out;
        }
        .lightbox img { max-width: 95%; max-height: 95%; object-fit: contain; }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="pf">
        <div
          className="pf-hero"
          style={profile.banner ? { backgroundImage: `url(${profile.banner})` } : undefined}
          onClick={() => profile.banner && setLightbox(profile.banner)}
        >
          <div className="pf-hero-inner">
            <img
              className="pf-avatar"
              src={profile.avatar_url || '/loguito.png'}
              alt=""
              onClick={(e) => {
                e.stopPropagation()
                if (profile.avatar_url) setLightbox(profile.avatar_url)
              }}
            />
          </div>
        </div>

        <div className="pf-identity">
          <h1>{profile.username || 'Usuario'}</h1>
          {profile.show_age !== false && profile.age != null && <p className="meta">Edad: {profile.age}</p>}
          {profile.role === 'admin' && <p className="meta">Autor / Admin</p>}
          <p className="bio">{profile.description || 'Sin descripción.'}</p>
        </div>

        {error && <div className="err">{error}</div>}

        <div className="pf-layout">
          <div className="pf-main">
            <div className="pf-card">
              <h2>💬 Muro</h2>
              {myId && myId !== userId && (
                <form onSubmit={postWall} style={{ marginBottom: 16 }}>
                  <textarea
                    className="field-textarea"
                    value={wallText}
                    onChange={(e) => setWallText(e.target.value)}
                    placeholder="Escribe en el muro…"
                    maxLength={500}
                    disabled={posting}
                  />
                  <button type="submit" className="pf-btn" disabled={posting || !wallText.trim()}>
                    {posting ? 'Enviando…' : 'Publicar'}
                  </button>
                </form>
              )}
              {!myId && <p className="muted">Inicia sesión para escribir en el muro.</p>}
              {wall.length === 0 && <p className="muted">Todavía no hay mensajes.</p>}
              {wall.map((w) => (
                <div key={w.id} className="wall-item">
                  <Link to={`/profiles/${w.author_id}`}>
                    <img src={w.profiles?.avatar_url || '/loguito.png'} alt="" />
                  </Link>
                  <div>
                    <div className="wall-meta">
                      <Link to={`/profiles/${w.author_id}`}>{w.profiles?.username || 'Usuario'}</Link>
                      {' · '}
                      {new Date(w.created_at).toLocaleDateString('es-ES')}
                    </div>
                    <div className="wall-text">{w.content}</div>
                  </div>
                </div>
              ))}
            </div>

            {profile.role === 'admin' && comicsList.length > 0 && (
              <div className="pf-card">
                <h2>📚 Arcos del autor</h2>
                <div className="arc-grid">
                  {comicsList.map((c) => (
                    <Link key={c.id} to={`/comic/${c.id}`}>
                      <img src={c.cover_url || '/loguito.png'} alt={c.title} />
                      {c.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {profile.show_folders !== false && folders.length > 0 && (
              <div className="pf-card">
                <h2>📁 Carpetas</h2>
                {folders.map((f) => (
                  <span
                    key={f.id}
                    className={`folder-chip ${activeFolder === f.id ? 'active' : ''}`}
                    onClick={() => setActiveFolder(activeFolder === f.id ? null : f.id)}
                  >
                    {f.name}
                  </span>
                ))}
                {activeFolder && (
                  <div className="fav-grid">
                    {(folderItems[activeFolder] || []).map((it) => (
                      <Link key={it.id} to={`/comic/${it.comic_id}`}>
                        <img src={it.comics?.cover_url || '/loguito.png'} alt={it.comics?.title} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="pf-side">
            {profile.show_likes !== false && (
              <div className="pf-card">
                <h2>❤️ Capítulos likeados</h2>
                <div className="side-list">
                  {likesCh.length === 0 && <p className="muted">Sin likes públicos.</p>}
                  {likesCh.map((l) => (
                    <div key={l.id} className="side-item" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {((l.chapters as any)?.icon_url || (l.chapters as any)?.comics?.cover_url) && (
                        <img
                          src={(l.chapters as any).icon_url || (l.chapters as any).comics?.cover_url}
                          alt=""
                          style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
                        />
                      )}
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
                  {likesCm.map((l) => (
                    <div key={l.id} className="side-item">
                      <Link to={`/comic/${(l.comments as any)?.chapters?.comic_id}/chapter/${(l.comments as any)?.chapter_id}`}>
                        {(l.comments as any)?.content?.slice(0, 70) || 'Comentario'}…
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.show_comments !== false && (
              <div className="pf-card">
                <h2>💬 Comentarios</h2>
                <div className="side-list">
                  {comments.length === 0 && <p className="muted">Sin comentarios públicos.</p>}
                  {comments.map((c) => (
                    <div key={c.id} className="side-item" style={{ display: 'flex', gap: 10 }}>
                      {(c.chapters as any)?.comics?.cover_url && (
                        <img
                          src={(c.chapters as any).comics.cover_url}
                          alt=""
                          style={{ width: 36, height: 48, borderRadius: 6, objectFit: 'cover' }}
                        />
                      )}
                      <div>
                        <div className="sub">{(c.chapters as any)?.comics?.title} · Cap. {c.chapters?.number}</div>
                        <Link to={`/comic/${c.chapters?.comic_id}/chapter/${c.chapter_id}`}>{c.content}</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <Footer />

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}