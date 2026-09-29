import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <>
      <style>{`
        .main-header {
          background: var(--header);
          padding: 15px 30px;
          display: flex;
          align-items: center;
          border-bottom: 5px solid #ffffff;
        }

        .main-header img {
          max-height: 60px;
          transition: transform 0.4s ease, filter 0.4s ease;
          filter: drop-shadow(0 0 8px #000);
          cursor: pointer;
        }

        .main-header img:hover {
          transform: scale(1.1) rotate(-5deg);
          filter: drop-shadow(0 0 14px #000);
        }

        .main-header h1 {
          margin: 0 0 0 14px;
          font-size: 2.4rem;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: var(--header-text);
          cursor: pointer;
          transition: transform 0.4s ease, color 0.4s ease;
          animation: neonAnimation 1.5s ease-in-out infinite alternate;
        }

        .main-header h1:hover {
          transform: scale(1.1) rotate(-5deg) translateX(8px);
          color: rgb(128, 129, 212);
        }

        @keyframes neonAnimation {
          0% {
            text-shadow: 0 0 5px #fff, 0 0 10px #000, 0 0 15px #000, 0 0 20px #000;
          }
          100% {
            text-shadow: 0 0 10px #000, 0 0 20px #000, 0 0 30px #000, 0 0 40px #000;
          }
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
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
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
      `}</style>

      <header className="main-header">
        <Link to="/home">
          <img src="/loguito.png" alt="Logo Popu Club" />
        </Link>
        <Link to="/home" style={{ textDecoration: 'none' }}>
          <h1>Popu-club</h1>
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