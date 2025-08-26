import { useEffect } from 'react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';

export function GoogleAuthCallback(): JSX.Element {
  const { handleAuthCallback } = useGoogleDrive();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      // Handle error
      console.error('OAuth error:', error);
      window.opener?.postMessage({ type: 'GOOGLE_AUTH_ERROR', error }, window.location.origin);
      window.close();
      return;
    }

    if (code) {
      handleAuthCallback(code)
        .then(() => {
          // Success - notify parent window and close
          window.opener?.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, window.location.origin);
          window.close();
        })
        .catch((err) => {
          console.error('Auth callback failed:', err);
          window.opener?.postMessage(
            {
              type: 'GOOGLE_AUTH_ERROR',
              error: err.message,
            },
            window.location.origin,
          );
          window.close();
        });
    }
  }, [handleAuthCallback]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}
