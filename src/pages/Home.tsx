import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'

const slides = [
  '/iconitos/ilustraciones para el slider/slider.png',
  '/iconitos/ilustraciones para el slider/slider2.png',
  '/iconitos/ilustraciones para el slider/slider3.png',
  '/iconitos/ilustraciones para el slider/slider4.png',
]

export default function Home() {
  const [index, setIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const slideRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  const nextSlide = () => setIndex((prev) => (prev + 1) % slides.length)
  const prevSlide = () => setIndex((prev) => (prev - 1 + slides.length) % slides.length)

  useEffect(() => {
    if (slideRef.current) {
      const width = slideRef.current.clientWidth
      slideRef.current.style.transform = `translateX(${-index * width}px)`
    }
  }, [index])

  useEffect(() => {
    const handleResize = () => {
      if (slideRef.current) {
        const width = slideRef.current.clientWidth
        slideRef.current.style.transform = `translateX(${-index * width}px)`
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [index])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isFullscreen) return
      if (e.key === 'ArrowRight') nextSlide()
      if (e.key === 'ArrowLeft') prevSlide()
      if (e.key === 'Escape') exitFullscreen()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isFullscreen, index])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextSlide()
      else prevSlide()
    }
  }

  const enterFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (el.requestFullscreen) el.requestFullscreen()
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen()
    setIsFullscreen(true)
  }

  const exitFullscreen = () => {
    if (document.exitFullscreen) document.exitFullscreen()
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen()
    setIsFullscreen(false)
  }

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  return (
    <>
      <style>{`
        .hero-section {
          padding: 35px 20px 20px;
          text-align: center;
        }
        .hero-section h2 {
          font-size: 2.2rem;
          margin-bottom: 18px;
          color: var(--text);
        }
        .carousel-container {
          position: relative;
          overflow: hidden;
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          border-radius: 18px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.25);
          cursor: pointer;
          background: #000;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .carousel-container:hover {
          transform: scale(1.015);
          box-shadow: 0 12px 28px rgba(0,0,0,0.35);
        }
        .carousel-slide {
          display: flex;
          transition: transform 0.55s ease;
        }
        .carousel-slide img {
          flex: 0 0 100%;
          width: 100%;
          height: auto;
          display: block;
          border-radius: 18px;
          user-select: none;
          -webkit-user-drag: none;
        }
        .carousel-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255,255,255,0.85);
          border: none;
          border-radius: 50%;
          width: 44px;
          height: 44px;
          font-size: 20px;
          cursor: pointer;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, transform 0.2s;
        }
        .carousel-arrow:hover {
          background: #fff;
          transform: translateY(-50%) scale(1.1);
        }
        .left-arrow { left: 14px; }
        .right-arrow { right: 14px; }
        .exit-fullscreen {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(0,0,0,0.75);
          color: white;
          border: 2px solid #FFFF00;
          padding: 8px 14px;
          border-radius: 8px;
          font-family: 'Laffayette Comic Pro', cursive;
          font-size: 14px;
          cursor: pointer;
          z-index: 20;
        }
        .content {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .content h2 {
          text-align: center;
          margin-bottom: 24px;
          font-size: 1.9rem;
          color: var(--text);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 22px;
        }
        .grid-item {
          background: var(--card);
          padding: 20px;
          border-radius: 15px;
          text-align: center;
          box-shadow: 0 6px 15px rgba(0,0,0,0.18);
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .grid-item:hover {
          transform: translateY(-10px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.25);
        }
        .grid-item img {
          width: 100%;
          border-radius: 12px;
        }
        .grid-item h3 {
          margin: 14px 0 8px;
          font-size: 1.25rem;
          color: var(--text);
        }
        .grid-item p {
          color: var(--muted);
          font-size: 1rem;
          margin: 0;
        }
        .carousel-container:fullscreen,
        .carousel-container:-webkit-full-screen {
          max-width: 100%;
          width: 100%;
          height: 100%;
          border-radius: 0;
          display: flex;
          align-items: center;
          background: #000;
          transform: none;
        }
        .carousel-container:fullscreen .carousel-slide img,
        .carousel-container:-webkit-full-screen .carousel-slide img {
          border-radius: 0;
          max-height: 100vh;
          object-fit: contain;
        }
      `}</style>

      <Header />
      <ProfileButton />

      <section className="hero-section">
        <h2>Contenido Destacado</h2>

        <div
          className="carousel-container"
          ref={containerRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (target.tagName === 'IMG' && !isFullscreen) {
              enterFullscreen()
              return
            }
            if (isFullscreen && target === containerRef.current) {
              exitFullscreen()
            }
          }}
        >
          {isFullscreen && (
            <button
              className="exit-fullscreen"
              onClick={(e) => {
                e.stopPropagation()
                exitFullscreen()
              }}
            >
              Salir de pantalla completa
            </button>
          )}

          <button
            className="carousel-arrow left-arrow"
            onClick={(e) => {
              e.stopPropagation()
              prevSlide()
            }}
          >
            ◀
          </button>

          <div className="carousel-slide" ref={slideRef}>
            {slides.map((src, i) => (
              <img key={i} src={src} alt={`Slide ${i + 1}`} />
            ))}
          </div>

          <button
            className="carousel-arrow right-arrow"
            onClick={(e) => {
              e.stopPropagation()
              nextSlide()
            }}
          >
            ▶
          </button>
        </div>
      </section>

      <section className="content">
        <h2>Arcos Recientes</h2>
        <div className="grid">
          <div className="grid-item">
            <Link to="/comic/1" style={{ textDecoration: 'none', color: 'inherit' }}>
              <img src="/iconitos/portadas verticales del inicio/introduccion.png" alt="Introducción" />
              <h3>Introducción</h3>
              <p>Aquí una pequeña descripción xd</p>
            </Link>
          </div>
          <div className="grid-item">
            <Link to="/comic/2" style={{ textDecoration: 'none', color: 'inherit' }}>
              <img src="/iconitos/portadas verticales del inicio/sweetmary.png" alt="Sweet Mary" />
              <h3>Sweet Mary</h3>
              <p>Aquí una pequeña descripción xd</p>
            </Link>
          </div>
          <div className="grid-item">
            <Link to="/comic/3" style={{ textDecoration: 'none', color: 'inherit' }}>
              <img src="/iconitos/portadas verticales del inicio/detencion.png" alt="Detención" />
              <h3>Detención</h3>
              <p>¡La detención!</p>
            </Link>
          </div>
          <div className="grid-item">
            <Link to="/comic/4" style={{ textDecoration: 'none', color: 'inherit' }}>
              <img src="/iconitos/portadas verticales del inicio/adelantosyavisos.png" alt="Exordo" />
              <h3>Exordo</h3>
              <p>Adelantos y Avisos</p>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
