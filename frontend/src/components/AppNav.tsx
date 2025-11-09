import { Link } from 'react-router-dom'
import './AppNav.css'

interface AppNavProps {
  signOut?: () => void
}

export function AppNav({ signOut }: AppNavProps) {
  return (
    <nav className="app-nav">
      <div className="nav-brand">
        <Link to="/">Hallway Track</Link>
      </div>
      <div className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/profile">My Profile</Link>
        <Link to="/connections">Connections</Link>
        <Link to="/qr-code">My QR Code</Link>
        {signOut && (
          <button onClick={signOut} className="btn-signout">
            Sign Out
          </button>
        )}
      </div>
    </nav>
  )
}
