import { AlertCircle, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface GoogleDriveAuthProps {
  // From useGoogleDrive hook
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authenticate: () => void;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  tokenExpiryInfo: { isNearExpiry: boolean; expiresAt?: number; minutesUntilExpiry?: number };

  // Own props
  onAuthChange?: (isAuthenticated: boolean) => void;
  variant?: 'card' | 'toolbar';
}

export function GoogleDriveAuth({
  isAuthenticated,
  isAuthenticating,
  authenticate,
  logout,
  error,
  clearError,
  tokenExpiryInfo,
  onAuthChange,
  variant = 'card',
}: GoogleDriveAuthProps): React.ReactElement {
  useEffect(() => {
    onAuthChange?.(isAuthenticated);
    if (isAuthenticated) {
      toast.success('Successfully connected to Google Drive!');
    }
  }, [isAuthenticated, onAuthChange]);

  const handleAuth = () => {
    clearError();
    authenticate();
  };

  const handleLogout = async () => {
    clearError();
    await logout();
  };

  if (variant === 'toolbar') {
    return (
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <span className="inline-flex items-center gap-1 text-xs text-primary">
            <Cloud className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Connected</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CloudOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Disconnected</span>
          </span>
        )}
        {isAuthenticated ? (
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={isAuthenticating}>
            {isAuthenticating && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={handleAuth} disabled={isAuthenticating}>
            {isAuthenticating && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Connect
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center space-x-2">
          {isAuthenticated ? (
            <>
              <Cloud className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
              <span className="truncate text-xs font-medium text-primary sm:text-sm md:text-base">
                <span className="xs:inline hidden">Connected to Google Drive</span>
                <span className="xs:hidden">Connected</span>
              </span>
            </>
          ) : (
            <>
              <CloudOff className="h-4 w-4 shrink-0 text-muted-foreground sm:h-5 sm:w-5" />
              <span className="truncate text-xs font-medium text-muted-foreground sm:text-sm md:text-base">
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

      {isAuthenticated && tokenExpiryInfo.isNearExpiry && (
        <Alert
          variant="default"
          className="border-amber-200 bg-amber-50 sm:items-center dark:border-amber-800 dark:bg-amber-950/20"
        >
          <AlertCircle className="text-amber-600 dark:text-amber-400" />
          <AlertDescription className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-grow text-amber-800 dark:text-amber-200">
              {tokenExpiryInfo.minutesUntilExpiry !== undefined &&
              tokenExpiryInfo.minutesUntilExpiry > 0
                ? `Session expires in ${tokenExpiryInfo.minutesUntilExpiry} minutes`
                : 'Session will expire soon'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAuth}
              className="flex-shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
            >
              Refresh
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="items-center">
          <AlertCircle />
          <AlertDescription className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-grow">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="flex-shrink-0 text-destructive hover:text-destructive/80"
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
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isAuthenticating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <span className="truncate">
              <span className="hidden sm:inline">Connect to Google Drive</span>
              <span className="sm:hidden">Connect</span>
            </span>
          </Button>
        )}
      </div>

      {!isAuthenticated && (
        <div className="space-y-1 text-xs text-muted-foreground">
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
