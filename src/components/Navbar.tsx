import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'center',
      backgroundColor: '#333',
      padding: '10px 0',
      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
      gap: '8px',
      flexWrap: 'wrap'
    }}>
      <Link
        to="/home"
        style={{
          color: '#fcfcfa',
          textDecoration: 'none',
          padding: '10px 20px',
          fontWeight: 'bold',
          fontSize: '1.1rem',
          borderRadius: '10px',
          transition: 'background-color 0.3s, color 0.3s'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = '#ffffff'
          e.currentTarget.style.color = '#333'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = '#fcfcfa'
        }}
      >
        Inicio
      </Link>

      <Link
        to="/arcos"
        style={{
          color: '#fcfcfa',
          textDecoration: 'none',
          padding: '10px 20px',
          fontWeight: 'bold',
          fontSize: '1.1rem',
          borderRadius: '10px',
          transition: 'background-color 0.3s, color 0.3s'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = '#ffffff'
          e.currentTarget.style.color = '#333'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = '#fcfcfa'
        }}
      >
        Arcos
      </Link>
    </nav>
  )
}