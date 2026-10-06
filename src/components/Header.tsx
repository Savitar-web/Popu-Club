import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <>
      <style>{`
        .main-header {
          background: var(--header);
          padding: 8px 28px;
          display: flex;
          align-items: center;
          border-bottom: 5px solid #ffffff;
        }

        .main-header .logo-icon {
          max-height: 88px;
          transition: transform 0.4s ease, filter 0.4s ease;
          filter: drop-shadow(0 0 8px #000);
          cursor: pointer;
        }

        .main-header .logo-icon:hover {
          transform: scale(1.1) rotate(-5deg);
          filter: drop-shadow(0 0 14px #000);
        }

        .title-wrap {
          display: inline-block;
          margin-left: 6px;
          line-height: 0;
          cursor: pointer;
          transition: transform 0.4s ease, filter 0.4s ease;
        }

        .title-wrap img {
          height: 90px;
          width: auto;
          display: block;
          transform: scaleX(1.32);
          transform-origin: left center;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
        }

        .title-wrap:hover {
          transform: scale(1.08) rotate(-5deg) translateX(6px);
          filter: brightness(1.05);
        }

        .title-wrap:hover img {
          transform: scaleX(1.32);
        }

        .nav-line {
          height: 5px;
          background: #ffffff;
          width: 100%;
        }

        .main-nav {
          display: flex;
          justify-content: center;
          background: var(--header);
          padding: 10px 0;
          gap: 6px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .main-nav a {
          color: #fcfcfa;
          text-decoration: none;
          padding: 10px 20px;
          font-weight: bold;
          font-size: 1.1rem;
          border-radius: 10px;
          transition: background-color 0.3s, color 0.3s;
        }

        .main-nav a:hover {
          background: #ffffff;
          color: #333;
        }

        @media (max-width: 500px) {
          .main-header {
            padding: 6px 12px;
          }

          .main-header .logo-icon {
            max-height: 64px;
          }

          .title-wrap img {
            height: 72px;
            transform: scaleX(1.1);
          }

          .title-wrap:hover img {
            transform: scaleX(1.1);
          }
        }
      `}</style>

      <header className="main-header">
        <Link to="/home">
          <img className="logo-icon" src="/loguito.png" alt="Logo Popu Club" />
        </Link>

        <Link to="/home" className="title-wrap" aria-label="Popu-Club">
          <img src="/logo-title.png" alt="POPU-CLUB" />
        </Link>
      </header>

      <div className="nav-line" />

      <nav className="main-nav">
        <Link to="/home">Inicio</Link>
        <Link to="/arcos">Arcos</Link>
      </nav>
    </>
  )
}