import React, { useEffect } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { useGoogleDrive } from '../hooks/useGoogleDrive'
import { Cloud, CloudOff, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface GoogleDriveAuthProps {
  onAuthChange?: (isAuthenticated: boolean) => void
}

export function GoogleDriveAuth({ onAuthChange }: GoogleDriveAuthProps): JSX.Element {
  const {
    isAuthenticated,
    isAuthenticating,
    authenticate,
    logout,
    error,
    clearError
  } = useGoogleDrive()

  useEffect(() => {
    onAuthChange?.(isAuthenticated)
    if (isAuthenticated) {
      toast.success('Successfully connected to Google Drive!')
    }
  }, [isAuthenticated, onAuthChange])

  // Handle auth callback from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        // Handle successful authentication
        console.log('Google auth successful')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleAuth = () => {
    clearError()
    authenticate()
  }

  const handleLogout = async () => {
    clearError()
    await logout()
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {isAuthenticated ? (
            <>
              <Cloud className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-600">Connected to Google Drive</span>
            </>
          ) : (
            <>
              <CloudOff className="h-5 w-5 text-gray-500" />
              <span className="font-medium text-gray-500">Not connected to Google Drive</span>
            </>
          )}
        </div>
        <Badge variant={isAuthenticated ? "default" : "outline"}>
          {isAuthenticated ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="ml-2 text-destructive hover:text-destructive/80"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex space-x-2">
        {isAuthenticated ? (
          <Button 
            onClick={handleLogout}
            variant="outline"
            disabled={isAuthenticating}
          >
            {isAuthenticating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Disconnect
          </Button>
        ) : (
          <Button 
            onClick={handleAuth}
            disabled={isAuthenticating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isAuthenticating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Connect to Google Drive
          </Button>
        )}
      </div>

      {!isAuthenticated && (
        <div className="text-xs text-gray-500 space-y-1">
          <p>Connect your Google Drive to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Select folders for saving processed files</li>
            <li>Save as Google Docs with custom names</li>
            <li>Automatically convert markdown to document format</li>
          </ul>
        </div>
      )}
    </Card>
  )
}