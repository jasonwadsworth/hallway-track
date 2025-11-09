import type { ReactNode } from 'react'
import { useAuthenticator } from '@aws-amplify/ui-react'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { authStatus } = useAuthenticator((context) => [context.authStatus])

  if (authStatus !== 'authenticated') {
    return null
  }

  return <>{children}</>
}
