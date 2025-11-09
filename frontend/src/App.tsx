import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import './App.css'

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main>
          <h1>Hallway Track</h1>
          <p>Welcome, {user?.signInDetails?.loginId}!</p>
          <button onClick={signOut}>Sign Out</button>
        </main>
      )}
    </Authenticator>
  )
}

export default App
