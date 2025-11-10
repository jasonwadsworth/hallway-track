import { useState } from 'react'
import { Link } from 'react-router-dom'
import './AppNav.css'

interface AppNavProps {
  signOut?: () => void
}

export function AppNav({ signOut }: AppNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <nav className="app-nav">
      <div className="nav-brand">
        <Link to="/">Hallway Track</Link>
      </div>

      <button
        className="hamburger-menu"
        onClick={toggleMobileMenu}
        aria-label="Toggle navigation menu"
        aria-expanded={mobileMenuOpen}
      >
        ☰
      </button>

      <div className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
        <Link to="/" onClick={closeMobileMenu}>Home</Link>
        <Link to="/profile" onClick={closeMobileMenu}>My Profile</Link>
        <Link to="/connections" onClick={closeMobileMenu}>Connections</Link>
        <Link to="/qr-code" onClick={closeMobileMenu}>My QR Code</Link>
        <Link to="/scan" onClick={closeMobileMenu}>📷 Scan QR Code</Link>
        {signOut && (
          <button onClick={() => { closeMobileMenu(); signOut(); }} className="btn-signout">
            Sign Out
          </button>
        )}
      </div>
    </nav>
  )
}
