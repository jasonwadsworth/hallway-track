import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { generateClient } from 'aws-amplify/api'
import { BadgeProgress } from './BadgeProgress'
import './Dashboard.css'

const client = generateClient()

interface Connection {
  id: string
  connectedUserId: string
  connectedUser: {
    displayName: string
    gravatarHash: string
  }
  createdAt: string
}

export function Dashboard() {
  const [recentConnections, setRecentConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecentConnections()
  }, [])

  const loadRecentConnections = async () => {
    try {
      const query = `
        query GetMyConnections {
          getMyConnections {
            id
            connectedUserId
            connectedUser {
              displayName
              gravatarHash
            }
            createdAt
          }
        }
      `

      const result = await client.graphql({ query }) as { data: { getMyConnections: Connection[] } }

      // Get the 5 most recent connections
      const recent = result.data.getMyConnections.slice(0, 5)
      setRecentConnections(recent)
    } catch (error) {
      console.error('Error loading recent connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className="dashboard">
      <h1>Welcome to Hallway Track</h1>

      <div className="quick-actions">
        <Link to="/qr-code" className="action-card">
          <div className="action-card-icon">📱</div>
          <h3>View My QR Code</h3>
          <p>Show your QR code to connect with others</p>
        </Link>

        <Link to="/connections" className="action-card">
          <div className="action-card-icon">👥</div>
          <h3>My Connections</h3>
          <p>View all your connections</p>
        </Link>

        <Link to="/profile" className="action-card">
          <div className="action-card-icon">✏️</div>
          <h3>Edit Profile</h3>
          <p>Update your display name and contact links</p>
        </Link>
      </div>

      <div className="dashboard-section">
        <h2>Badge Progress</h2>
        <BadgeProgress />
      </div>

      <div className="dashboard-section">
        <h2>Recent Connections</h2>
        {loading ? (
          <p>Loading...</p>
        ) : recentConnections.length > 0 ? (
          <div className="recent-connections">
            {recentConnections.map((connection) => (
              <Link
                key={connection.id}
                to={`/connections/${connection.id}`}
                className="recent-connection-item"
              >
                <img
                  src={`https://www.gravatar.com/avatar/${connection.connectedUser.gravatarHash}?d=identicon&s=100`}
                  alt={connection.connectedUser.displayName}
                  className="recent-connection-avatar"
                />
                <div className="recent-connection-info">
                  <div className="recent-connection-name">
                    {connection.connectedUser.displayName}
                  </div>
                  <div className="recent-connection-date">
                    Connected {formatDate(connection.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="no-connections">
            <p>You haven't made any connections yet.</p>
            <Link to="/qr-code" className="btn-primary">
              Show My QR Code
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
