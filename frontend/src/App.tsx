import { Authenticator } from '@aws-amplify/ui-react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import '@aws-amplify/ui-react/styles.css'
import './App.css'
import { AppNav } from './components/AppNav'
import { Dashboard } from './components/Dashboard'
import { Profile } from './components/Profile'
import { QRCodeDisplay } from './components/QRCodeDisplay'
import { ConnectionList } from './components/ConnectionList'
import { ConnectionDetail } from './components/ConnectionDetail'
import { PublicProfile } from './components/PublicProfile'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <Authenticator>
      {({ signOut }) => (
        <BrowserRouter>
          <AppNav signOut={signOut} />
          <main>
            <Routes>
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/profile/:userId" element={<PublicProfile />} />
              <Route path="/connections" element={
                <ProtectedRoute>
                  <ConnectionList />
                </ProtectedRoute>
              } />
              <Route path="/connections/:id" element={
                <ProtectedRoute>
                  <ConnectionDetail />
                </ProtectedRoute>
              } />
              <Route path="/qr-code" element={
                <ProtectedRoute>
                  <QRCodeDisplay />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </BrowserRouter>
      )}
    </Authenticator>
  )
}

export default App
