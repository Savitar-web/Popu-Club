import { useEffect, useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import { supabase, isSupabaseConfigured, isAdmin, getMyProfile } from '../lib/supabase'

type Comic = {
  id: string
  title: string
  description: string | null
  cover_url: string | null
  genre: string | null
  status: string
  created_at?: string
}

type Chapter = {
  id: string
  comic_id: string
  number: number
  title: string
  status: string
  published_at: string | null
}

type CommentRow = {
  id: string
  content: string
  created_at: string
  chapter_id: string
  user_id: string
  profiles?: { username: string | null } | null
}

export default function Admin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [tab, setTab] = useState<'comics' | 'chapters' | 'comments'>('comics')
  const [comics, setComics] = useState<Comic[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [selectedComicId, setSelectedComicId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Form nuevo / editar comic
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('Drama')
  const [status, setStatus] = useState('draft')
  const [coverFile, setCoverFile] = useState<File | null>(null)

  // Nuevo capítulo
  const [chNumber, setChNumber] = useState(1)
  const [chTitle, setChTitle] = useState('')
  const [chStatus, setChStatus] = useState('draft')
  const [pageFiles, setPageFiles] = useState<FileList | null>(null)

  useEffect(() => {
    ;(async () => {
      if (!isSupabaseConfigured || !supabase) {
        // Fallback localStorage para pruebas
        const role = localStorage.getItem('role')
        if (role === 'admin') {
          setAllowed(true)
        } else {
          setError('Supabase no configurado o no eres admin. Ejecuta FIX-ADMIN.sql y vuelve a iniciar sesión.')
        }
        setLoading(false)
        return
      }

      const ok = await isAdmin()
      if (!ok) {
        setError('No tienes rol admin. Cierra sesión, inicia con tu cuenta y ejecuta FIX-ADMIN.sql en Supabase.')
        setLoading(false)
        return
      }
      setAllowed(true)
      await loadComics()
      setLoading(false)
    })()
  }, [])

  const loadComics = async () => {
    if (!supabase) return
    const { data, error: err } = await supabase
      .from('comics')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setComics((data as Comic[]) || [])
  }

  const loadChapters = async (comicId: string) => {
    if (!supabase || !comicId) return
    const { data, error: err } = await supabase
      .from('chapters')
      .select('*')
      .eq('comic_id', comicId)
      .order('number', { ascending: true })
    if (err) setError(err.message)
    else setChapters((data as Chapter[]) || [])
  }

  const loadComments = async () => {
    if (!supabase) return
    const { data, error: err } = await supabase
      .from('comments')
      .select('id, content, created_at, chapter_id, user_id, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (err) setError(err.message)
    else setComments((data as any) || [])
  }

  useEffect(() => {
    if (tab === 'comments' && allowed) loadComments()
  }, [tab, allowed])

  useEffect(() => {
    if (selectedComicId) loadChapters(selectedComicId)
  }, [selectedComicId])

  const resetComicForm = () => {
    setEditId(null)
    setTitle('')
    setDescription('')
    setGenre('Drama')
    setStatus('draft')
    setCoverFile(null)
  }

  const saveComic = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setMessage('')
    setError('')

    const profile = await getMyProfile()
    let cover_url: string | null = null

    if (coverFile) {
      const path = `covers/${Date.now()}-${coverFile.name.replace(/\s+/g, '-')}`
      const { error: upErr } = await supabase.storage.from('comics').upload(path, coverFile, {
        upsert: true,
        contentType: coverFile.type,
      })
      if (upErr) {
        setError('Error subiendo portada: ' + upErr.message)
        return
      }
      const { data: pub } = supabase.storage.from('comics').getPublicUrl(path)
      cover_url = pub.publicUrl
    }

    if (editId) {
      const payload: any = { title, description, genre, status, updated_at: new Date().toISOString() }
      if (cover_url) payload.cover_url = cover_url
      const { error: err } = await supabase.from('comics').update(payload).eq('id', editId)
      if (err) setError(err.message)
      else {
        setMessage('Cómic actualizado')
        resetComicForm()
        await loadComics()
      }
    } else {
      const { error: err } = await supabase.from('comics').insert({
        title,
        description,
        genre,
        status,
        cover_url,
        created_by: profile?.id,
      })
      if (err) setError(err.message)
      else {
        setMessage('Cómic creado')
        resetComicForm()
        await loadComics()
      }
    }
  }

  const deleteComic = async (id: string) => {
    if (!supabase) return
    if (!confirm('¿Borrar este arco y todos sus capítulos?')) return
    const { error: err } = await supabase.from('comics').delete().eq('id', id)
    if (err) setError(err.message)
    else {
      setMessage('Arco eliminado')
      await loadComics()
    }
  }

  const startEdit = (c: Comic) => {
    setEditId(c.id)
    setTitle(c.title)
    setDescription(c.description || '')
    setGenre(c.genre || 'Drama')
    setStatus(c.status)
    setTab('comics')
  }

  const createChapter = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !selectedComicId) {
      setError('Elige un arco primero')
      return
    }
    setError('')
    setMessage('')

    const { data: ch, error: err } = await supabase
      .from('chapters')
      .insert({
        comic_id: selectedComicId,
        number: chNumber,
        title: chTitle,
        status: chStatus,
        published_at: chStatus === 'published' ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (err || !ch) {
      setError(err?.message || 'No se pudo crear el capítulo')
      return
    }

    if (pageFiles && pageFiles.length > 0) {
      const files = Array.from(pageFiles).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const path = `chapters/${ch.id}/${String(i + 1).padStart(3, '0')}-${file.name.replace(/\s+/g, '-')}`
        const { error: upErr } = await supabase.storage.from('comics').upload(path, file, {
          upsert: true,
          contentType: file.type,
        })
        if (upErr) {
          setError('Error subiendo página: ' + upErr.message)
          break
        }
        const { data: pub } = supabase.storage.from('comics').getPublicUrl(path)
        await supabase.from('pages').insert({
          chapter_id: ch.id,
          image_url: pub.publicUrl,
          page_number: i + 1,
        })
      }
    }

    setMessage(`Capítulo ${chNumber} creado`)
    setChTitle('')
    setPageFiles(null)
    await loadChapters(selectedComicId)
  }

  const deleteChapter = async (id: string) => {
    if (!supabase) return
    if (!confirm('¿Borrar este capítulo y sus páginas?')) return
    const { error: err } = await supabase.from('chapters').delete().eq('id', id)
    if (err) setError(err.message)
    else {
      setMessage('Capítulo borrado')
      if (selectedComicId) await loadChapters(selectedComicId)
    }
  }

  const toggleChapterPublish = async (ch: Chapter) => {
    if (!supabase) return
    const next = ch.status === 'published' ? 'draft' : 'published'
    const { error: err } = await supabase
      .from('chapters')
      .update({
        status: next,
        published_at: next === 'published' ? new Date().toISOString() : null,
      })
      .eq('id', ch.id)
    if (err) setError(err.message)
    else if (selectedComicId) await loadChapters(selectedComicId)
  }

  const deleteComment = async (id: string) => {
    if (!supabase) return
    if (!confirm('¿Eliminar este comentario?')) return
    const { error: err } = await supabase.from('comments').delete().eq('id', id)
    if (err) setError(err.message)
    else {
      setMessage('Comentario eliminado')
      await loadComments()
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: "'Laffayette Comic Pro', cursive" }}>
        Comprobando permisos admin…
      </div>
    )
  }

  if (!allowed) {
    return (
      <>
        <Header />
        <ProfileButton />
        <div style={{ maxWidth: 560, margin: '40px auto', padding: 24, background: 'var(--card)', borderRadius: 14 }}>
          <h1>Panel admin</h1>
          <p style={{ color: 'crimson' }}>{error}</p>
          <p>1. Regístrate / inicia sesión con tu email en la web.</p>
          <p>2. En Supabase → SQL Editor ejecuta <strong>FIX-ADMIN.sql</strong>.</p>
          <p>3. Cierra sesión y vuelve a entrar.</p>
          <p>4. Abre <Link to="/admin">/admin</Link> otra vez.</p>
          <button type="button" onClick={() => navigate('/home')} style={{ marginTop: 16, padding: '10px 16px' }}>
            Ir a Home
          </button>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <style>{`
        .admin-wrap { max-width: 1000px; margin: 0 auto; padding: 24px 16px 60px; font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif; }
        .admin-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .admin-tabs button {
          padding: 10px 16px; border-radius: 10px; border: 2px solid #333; cursor: pointer;
          background: var(--card); color: var(--text); font-family: inherit; font-weight: bold;
        }
        .admin-tabs button.active { background: linear-gradient(135deg, #FFFF00, #FFD700); color: #111; }
        .admin-card {
          background: var(--card); border-radius: 14px; padding: 20px; margin-bottom: 20px;
          box-shadow: 0 6px 15px rgba(0,0,0,0.12);
        }
        .admin-card h2 { margin-top: 0; border-bottom: 3px solid #FFD700; padding-bottom: 8px; }
        .admin-card label { display: block; margin: 10px 0 4px; font-size: 13px; }
        .admin-card input, .admin-card textarea, .admin-card select {
          width: 100%; padding: 10px; border-radius: 8px; border: 3px solid #494949;
          font-family: inherit; box-sizing: border-box;
        }
        .btn-yellow {
          margin-top: 12px; padding: 12px 18px; border: none; border-radius: 8px; cursor: pointer;
          background: linear-gradient(135deg, #FFFF00, #FFD700); font-family: inherit; font-weight: bold;
        }
        .btn-danger { background: #c0392b; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-family: inherit; }
        .btn-small { padding: 6px 10px; margin-right: 6px; border-radius: 6px; border: none; cursor: pointer; font-family: inherit; }
        .row-list { border-top: 1px solid #ddd; padding: 12px 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
        .msg { background: #d4edda; color: #155724; padding: 10px; border-radius: 8px; margin-bottom: 12px; }
        .err { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px; margin-bottom: 12px; }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="admin-wrap">
        <h1>Panel de administración</h1>
        <p style={{ color: 'var(--muted)' }}>Gestiona arcos, capítulos, páginas y comentarios.</p>

        {message && <div className="msg">{message}</div>}
        {error && <div className="err">{error}</div>}

        <div className="admin-tabs">
          <button type="button" className={tab === 'comics' ? 'active' : ''} onClick={() => setTab('comics')}>
            📚 Arcos
          </button>
          <button type="button" className={tab === 'chapters' ? 'active' : ''} onClick={() => setTab('chapters')}>
            📖 Capítulos
          </button>
          <button type="button" className={tab === 'comments' ? 'active' : ''} onClick={() => setTab('comments')}>
            💬 Comentarios
          </button>
        </div>

        {tab === 'comics' && (
          <>
            <div className="admin-card">
              <h2>{editId ? 'Editar arco' : 'Nuevo arco'}</h2>
              <form onSubmit={saveComic}>
                <label>Título</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
                <label>Descripción</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                <label>Género</label>
                <input value={genre} onChange={(e) => setGenre(e.target.value)} />
                <label>Estado</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Borrador</option>
                  <option value="ongoing">En curso</option>
                  <option value="completed">Completo</option>
                  <option value="hiatus">Pausa</option>
                </select>
                <label>Portada (imagen)</label>
                <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
                <button type="submit" className="btn-yellow">{editId ? 'Guardar cambios' : 'Crear arco'}</button>
                {editId && (
                  <button type="button" className="btn-small" style={{ marginLeft: 8 }} onClick={resetComicForm}>
                    Cancelar edición
                  </button>
                )}
              </form>
            </div>

            <div className="admin-card">
              <h2>Arcos existentes</h2>
              {comics.length === 0 && <p>No hay arcos aún. Crea el primero arriba.</p>}
              {comics.map((c) => (
                <div key={c.id} className="row-list">
                  <div>
                    <strong>{c.title}</strong>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {c.status} · {c.genre || '—'}
                    </div>
                  </div>
                  <div>
                    <button type="button" className="btn-small" onClick={() => startEdit(c)}>Editar</button>
                    <button type="button" className="btn-small" onClick={() => { setSelectedComicId(c.id); setTab('chapters') }}>
                      Capítulos
                    </button>
                    <Link className="btn-small" to={`/comic/${c.id}`} style={{ display: 'inline-block', background: '#eee', padding: '6px 10px', textDecoration: 'none' }}>
                      Ver
                    </Link>
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
              <select
                value={selectedComicId}
                onChange={(e) => setSelectedComicId(e.target.value)}
              >
                <option value="">— Selecciona —</option>
                {comics.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            {selectedComicId && (
              <div className="admin-card">
                <h2>Nuevo capítulo + páginas</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Sube varias imágenes WebP/PNG ordenadas por nombre (001, 002…). Se publicarán en orden vertical como Webtoon.
                </p>
                <form onSubmit={createChapter}>
                  <label>Número</label>
                  <input type="number" min={1} value={chNumber} onChange={(e) => setChNumber(Number(e.target.value))} required />
                  <label>Título del capítulo</label>
                  <input value={chTitle} onChange={(e) => setChTitle(e.target.value)} required />
                  <label>Estado</label>
                  <select value={chStatus} onChange={(e) => setChStatus(e.target.value)}>
                    <option value="draft">Borrador</option>
                    <option value="published">Publicado</option>
                  </select>
                  <label>Páginas (múltiples imágenes)</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => setPageFiles(e.target.files)} />
                  <button type="submit" className="btn-yellow">Crear capítulo y subir páginas</button>
                </form>
              </div>
            )}

            {selectedComicId && (
              <div className="admin-card">
                <h2>Capítulos del arco</h2>
                {chapters.length === 0 && <p>Sin capítulos todavía.</p>}
                {chapters.map((ch) => (
                  <div key={ch.id} className="row-list">
                    <div>
                      <strong>#{ch.number} — {ch.title}</strong>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{ch.status}</div>
                    </div>
                    <div>
                      <button type="button" className="btn-small" onClick={() => toggleChapterPublish(ch)}>
                        {ch.status === 'published' ? 'Despublicar' : 'Publicar'}
                      </button>
                      <Link
                        to={`/comic/${selectedComicId}/chapter/${ch.id}`}
                        className="btn-small"
                        style={{ display: 'inline-block', background: '#eee', padding: '6px 10px', textDecoration: 'none' }}
                      >
                        Leer
                      </Link>
                      <button type="button" className="btn-danger" onClick={() => deleteChapter(ch.id)}>Borrar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'comments' && (
          <div className="admin-card">
            <h2>Moderar comentarios</h2>
            {comments.length === 0 && <p>No hay comentarios.</p>}
            {comments.map((c) => (
              <div key={c.id} className="row-list">
                <div style={{ flex: 1, minWidth: 200 }}>
                  <strong>{c.profiles?.username || 'Usuario'}</strong>
                  <p style={{ margin: '4px 0' }}>{c.content}</p>
                  <small style={{ color: 'var(--muted)' }}>{new Date(c.created_at).toLocaleString()}</small>
                </div>
                <button type="button" className="btn-danger" onClick={() => deleteComment(c.id)}>
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </>
  )
}