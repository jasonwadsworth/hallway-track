import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { generateClient } from 'aws-amplify/api'
import { BadgeProgress } from './BadgeProgress'
import { ErrorMessage } from './ErrorMessage'
import { LoadingSpinner } from './LoadingSpinner'
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling'
import type { ConnectionRequest } from '../types'
import './Dashboard.css'

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
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRecentConnections()
  }, [])

  const loadRecentConnections = async () => {
    const client = generateClient()
    try {
      setLoading(true)
      setError(null)

      const { getMyConnections: connectionsQuery, getIncomingConnectionRequests } = await import('../graphql/queries')
      const { getConnectedProfile } = await import('../graphql/queries')

      // Load both connections and pending requests
      const [connectionsResponse, requestsResponse] = await Promise.all([
        client.graphql({ query: connectionsQuery }),
        client.graphql({ query: getIncomingConnectionRequests }),
      ])

      // Handle pending requests count
      if ('data' in requestsResponse && requestsResponse.data) {
        const requests = requestsResponse.data.getIncomingConnectionRequests as ConnectionRequest[]
        setPendingRequestsCount(requests.length)
      }

      const response = connectionsResponse

      if ('data' in response && response.data) {
        const connections = response.data.getMyConnections as Array<{
          id: string
          connectedUserId: string
          createdAt: string
        }>

        // Get the 5 most recent connections and fetch their user details
        const recentIds = connections
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)

        const connectionsWithUsers = await Promise.all(
          recentIds.map(async (connection) => {
            try {
              const userResponse = await client.graphql({
                query: getConnectedProfile,
                variables: { userId: connection.connectedUserId },
              })

              if ('data' in userResponse && userResponse.data) {
                return {
                  ...connection,
                  connectedUser: {
                    displayName: userResponse.data.getConnectedProfile.displayName,
                    gravatarHash: userResponse.data.getConnectedProfile.gravatarHash,
                  },
                }
              }
              return null
            } catch (err) {
              console.error('Error loading connected user:', err)
              return null
            }
          })
        )

        setRecentConnections(connectionsWithUsers.filter((c): c is Connection => c !== null))
      }
    } catch (err) {
      console.error('Error loading recent connections:', err)
      const errorInfo = parseGraphQLError(err)
      setError(errorInfo.message)

      if (errorInfo.isAuthError) {
        await handleAuthError()
      }
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
      <h1>Welcome to HallwayTrak</h1>

      <div className="dashboard-section">
        <h2>Badge Progress</h2>
        <BadgeProgress />
      </div>

      {pendingRequestsCount > 0 && (
        <div className="dashboard-section">
          <h2>Connection Requests</h2>
          <div className="connection-requests-summary">
            <p>You have {pendingRequestsCount} pending connection request{pendingRequestsCount !== 1 ? 's' : ''}</p>
            <Link to="/connection-requests" className="btn-primary">
              View Requests
            </Link>
          </div>
        </div>
      )}

      <div className="dashboard-section">
        <h2>Recent Connections</h2>
        {error ? (
          <ErrorMessage
            message={error}
            onRetry={loadRecentConnections}
            onDismiss={() => setError(null)}
          />
        ) : loading ? (
          <LoadingSpinner message="Loading recent connections..." />
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
