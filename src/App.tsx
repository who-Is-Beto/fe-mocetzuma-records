import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './app/providers/AuthProvider'
import { WishlistProvider } from './app/providers/WishlistProvider'
import { router } from './app/router/routes'

function App() {
  return (
    <AuthProvider>
      <WishlistProvider>
        <RouterProvider router={router} />
      </WishlistProvider>
    </AuthProvider>
  )
}

export default App
