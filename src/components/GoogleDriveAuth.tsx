import type { DrivePreparationStatus, TokenExpiryInfo } from '@/hooks/useGoogleDrive';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';

interface GoogleDriveAuthProps {
  preparationStatus: DrivePreparationStatus;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  prepareDrive: () => void;
  connect: () => void;
  refresh: () => void;
  logout: () => Promise<void>;
  connectionError: string | null;
  tokenExpiryInfo: TokenExpiryInfo;
}

export function GoogleDriveAuth({
  preparationStatus,
  isAuthenticated,
  isAuthenticating,
  prepareDrive,
  connect,
  refresh,
  logout,
  connectionError,
  tokenExpiryInfo,
}: GoogleDriveAuthProps): React.ReactElement {
  const wasAuthenticatingRef = useRef(false);
  const wasAuthenticatedRef = useRef(isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && !wasAuthenticatedRef.current && wasAuthenticatingRef.current) {
      toast.success('Successfully connected to Google Drive!');
    }
    wasAuthenticatedRef.current = isAuthenticated;
    wasAuthenticatingRef.current = isAuthenticating;
  }, [isAuthenticated, isAuthenticating]);

  const isReady = preparationStatus === 'ready';
  const isConnected = isReady && isAuthenticated;
  let statusLabel = 'Disconnected';
  if (preparationStatus === 'preparing') statusLabel = 'Preparing Drive';
  else if (preparationStatus === 'error') statusLabel = 'Drive unavailable';
  else if (isAuthenticated) statusLabel = 'Connected';

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {connectionError && (
        <span
          role="alert"
          title={connectionError}
          className="max-w-48 truncate text-xs text-destructive"
        >
          {connectionError}
        </span>
      )}
      <span
        className={`inline-flex items-center gap-1 text-xs ${isConnected ? 'text-primary' : 'text-muted-foreground'}`}
      >
        {isConnected ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{statusLabel}</span>
      </span>

      {preparationStatus === 'preparing' ? (
        <Button variant="outline" size="sm" className="h-8 px-2.5" disabled>
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          Preparing
        </Button>
      ) : !isReady ? (
        <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={prepareDrive}>
          Retry setup
        </Button>
      ) : (
        <>
          {isAuthenticated && tokenExpiryInfo.isNearExpiry && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5"
              onClick={refresh}
              disabled={isAuthenticating}
            >
              {isAuthenticating && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Renew session
            </Button>
          )}
          {isAuthenticated ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5"
              onClick={logout}
              disabled={isAuthenticating}
            >
              Disconnect
            </Button>
          ) : (
            <Button size="sm" className="h-8 px-2.5" onClick={connect} disabled={isAuthenticating}>
              {isAuthenticating && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Connect
            </Button>
          )}
        </>
      )}
    </div>
  );
}
