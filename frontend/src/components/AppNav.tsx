import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './AppNav.css'

interface AppNavProps {
  signOut?: () => void
}

export function AppNav({ signOut }: AppNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false)
      }
    }

    // Add listener with slight delay to prevent immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [mobileMenuOpen])

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

      <div ref={menuRef} className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
        <Link to="/" onClick={closeMobileMenu}>🏠 Home</Link>
        <Link to="/profile" onClick={closeMobileMenu}>👤 My Profile</Link>
        <Link to="/connections" onClick={closeMobileMenu}>👥 Connections</Link>
        <Link to="/qr-code" onClick={closeMobileMenu}>📱 My QR Code</Link>
        <Link to="/scan" onClick={closeMobileMenu}>📷 Scan QR Code</Link>
        {signOut && (
          <button onClick={() => { closeMobileMenu(); signOut(); }} className="btn-signout">
            🚪 Sign Out
          </button>
        )}
      </div>
    </nav>
  )
}
