import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import './App.css'
import { Profile } from './components/Profile'

function App() {
  return (
    <Authenticator>
      {({ signOut }) => (
        <main>
          <header className="app-header">
            <h1>Hallway Track</h1>
            <button onClick={signOut} className="btn-signout">Sign Out</button>
          </header>
          <Profile />
        </main>
      )}
    </Authenticator>
  )
}

export default App
