import React, { useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { Cloud, CloudOff, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface GoogleDriveAuthProps {
  onAuthChange?: (isAuthenticated: boolean) => void;
}

export function GoogleDriveAuth({ onAuthChange }: GoogleDriveAuthProps): JSX.Element {
  const { isAuthenticated, isAuthenticating, authenticate, logout, error, clearError } =
    useGoogleDrive();

  useEffect(() => {
    onAuthChange?.(isAuthenticated);
    if (isAuthenticated) {
      toast.success('Successfully connected to Google Drive!');
    }
  }, [isAuthenticated, onAuthChange]);

  // Handle auth callback from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        // Handle successful authentication
        console.log('Google auth successful');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleAuth = () => {
    clearError();
    authenticate();
  };

  const handleLogout = async () => {
    clearError();
    await logout();
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center space-x-2">
          {isAuthenticated ? (
            <>
              <Cloud className="text-primary h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
              <span className="text-primary truncate text-xs font-medium sm:text-sm md:text-base">
                <span className="xs:inline hidden">Connected to Google Drive</span>
                <span className="xs:hidden">Connected</span>
              </span>
            </>
          ) : (
            <>
              <CloudOff className="text-muted-foreground h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
              <span className="text-muted-foreground truncate text-xs font-medium sm:text-sm md:text-base">
                <span className="xs:inline hidden">Not connected to Google Drive</span>
                <span className="xs:hidden">Not connected</span>
              </span>
            </>
          )}
        </div>
        <Badge
          variant={isAuthenticated ? 'default' : 'outline'}
          className="shrink-0 px-1.5 py-0.5 text-xs sm:px-2 sm:py-1 sm:text-xs"
        >
          {isAuthenticated ? 'Connected' : 'Disconnected'}
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
              className="text-destructive hover:text-destructive/80 ml-2"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex space-x-2">
        {isAuthenticated ? (
          <Button onClick={handleLogout} variant="outline" disabled={isAuthenticating}>
            {isAuthenticating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Disconnect
          </Button>
        ) : (
          <Button
            onClick={handleAuth}
            disabled={isAuthenticating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isAuthenticating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect to Google Drive
          </Button>
        )}
      </div>

      {!isAuthenticated && (
        <div className="text-muted-foreground space-y-1 text-xs">
          <p>Connect your Google Drive to:</p>
          <ul className="ml-2 list-inside list-disc space-y-1">
            <li>Select folders for saving processed files</li>
            <li>Save as Google Docs with custom names</li>
            <li>Automatically convert markdown to document format</li>
          </ul>
        </div>
      )}
    </Card>
  );
}
