import { Authenticator } from '@aws-amplify/ui-react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import '@aws-amplify/ui-react/styles.css'
import './App.css'
import { AppNav } from './components/AppNav'
import { Dashboard } from './components/Dashboard'
import { Profile } from './components/Profile'
import { QRCodeDisplay } from './components/QRCodeDisplay'
import { QRCodeScanner } from './components/QRCodeScanner'
import { ConnectionList } from './components/ConnectionList'
import { ConnectionDetail } from './components/ConnectionDetail'
import { ConnectionRequestsManager } from './components/ConnectionRequestsManager'
import { PublicProfile } from './components/PublicProfile'
import { BadgeShowcase } from './components/BadgeShowcase'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  // Handle orientation changes to maintain scroll position
  useEffect(() => {
    let scrollPosition = 0;

    const handleOrientationChange = () => {
      // Save scroll position before orientation change
      scrollPosition = window.scrollY;

      // Restore scroll position after layout adjustment
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    };

    // Listen for orientation change events
    window.addEventListener('orientationchange', handleOrientationChange);

    // Also listen for resize events as a fallback
    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        // Only handle if it's likely an orientation change (significant dimension swap)
        const aspectRatio = window.innerWidth / window.innerHeight;
        if (aspectRatio < 1 || aspectRatio > 1) {
          handleOrientationChange();
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

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
              <Route path="/connection-requests" element={
                <ProtectedRoute>
                  <ConnectionRequestsManager />
                </ProtectedRoute>
              } />
              <Route path="/badges" element={
                <ProtectedRoute>
                  <BadgeShowcase />
                </ProtectedRoute>
              } />
              <Route path="/qr-code" element={
                <ProtectedRoute>
                  <QRCodeDisplay />
                </ProtectedRoute>
              } />
              <Route path="/scan" element={
                <ProtectedRoute>
                  <QRCodeScanner />
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
