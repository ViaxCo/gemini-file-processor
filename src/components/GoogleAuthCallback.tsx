import { useEffect } from 'react'
import { useGoogleDrive } from '../hooks/useGoogleDrive'

export function GoogleAuthCallback(): JSX.Element {
  const { handleAuthCallback } = useGoogleDrive()

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')

    if (error) {
      // Handle error
      console.error('OAuth error:', error)
      window.opener?.postMessage({ type: 'GOOGLE_AUTH_ERROR', error }, window.location.origin)
      window.close()
      return
    }

    if (code) {
      handleAuthCallback(code)
        .then(() => {
          // Success - notify parent window and close
          window.opener?.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, window.location.origin)
          window.close()
        })
        .catch((err) => {
          console.error('Auth callback failed:', err)
          window.opener?.postMessage({ 
            type: 'GOOGLE_AUTH_ERROR', 
            error: err.message 
          }, window.location.origin)
          window.close()
        })
    }
  }, [handleAuthCallback])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  )
}