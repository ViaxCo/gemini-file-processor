import MarkdownIt from 'markdown-it';

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

export interface GoogleDriveConfig {
  clientId: string;
  apiKey: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

export interface TokenExpiryInfo {
  isNearExpiry: boolean;
  expiresAt?: number;
  minutesUntilExpiry?: number;
}

export class GoogleDriveAuthenticationError extends Error {}

export class GoogleDriveService {
  private config: GoogleDriveConfig;
  private initializationPromise: Promise<void> | null = null;
  private accessTokenPromise: Promise<boolean> | null = null;
  private resolveAccessToken: ((success: boolean) => void) | null = null;
  private accessTokenTimeout: ReturnType<typeof setTimeout> | null = null;
  private tokenClient: any = null;
  private md = new MarkdownIt();

  private readonly DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  private readonly SCOPES = 'https://www.googleapis.com/auth/drive';

  constructor(config: GoogleDriveConfig) {
    this.config = config;
  }

  prepare(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Google Drive is only available in the browser'));
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeGoogleApi().catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    }

    return this.initializationPromise;
  }

  private async initializeGoogleApi(): Promise<void> {
    try {
      await this.loadScript('https://apis.google.com/js/api.js', () => !!window.gapi);
      await this.loadScript(
        'https://accounts.google.com/gsi/client',
        () => !!window.google?.accounts,
      );
      await this.initializeDriveClient();

      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.config.clientId,
        scope: this.SCOPES,
        callback: (response: any) => this.handleAccessTokenResponse(response),
        error_callback: (error: any) => {
          console.error('Google OAuth popup failed:', error?.type || error);
          this.finishAccessTokenRequest(false);
        },
      });
      this.restoreStoredToken();
    } catch (error) {
      console.error('Error initializing GAPI:', error);
      throw new Error('Failed to initialize Google API');
    }
  }

  private initializeDriveClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        settled = true;
        reject(new Error('Google API initialization timed out'));
      }, 15000);

      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };

      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: this.config.apiKey,
            discoveryDocs: [this.DISCOVERY_DOC],
          });
          finish();
        } catch (error) {
          finish(error);
        }
      });
    });
  }

  private loadScript(src: string, isLoadedCheck: () => boolean): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.reject(new Error('Cannot load scripts during server-side rendering'));
    }
    if (isLoadedCheck()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
      const script = existingScript || document.createElement('script');
      let interval: ReturnType<typeof setInterval>;
      let timeout: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearInterval(interval);
        clearTimeout(timeout);
        script.removeEventListener('error', handleError);
      };
      const handleError = () => {
        cleanup();
        if (!existingScript) script.remove();
        reject(new Error(`Failed to load script: ${src}`));
      };

      script.addEventListener('error', handleError);
      interval = setInterval(() => {
        if (!isLoadedCheck()) return;
        cleanup();
        resolve();
      }, 100);
      timeout = setTimeout(() => {
        cleanup();
        if (!existingScript) script.remove();
        reject(new Error(`Timed out loading script: ${src}`));
      }, 10000);

      if (!existingScript) {
        script.src = src;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });
  }

  private storeToken(tokenResponse: any): void {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const tokenData = {
        access_token: tokenResponse.access_token,
        expires_at: Date.now() + tokenResponse.expires_in * 1000,
        scope: tokenResponse.scope,
        // Add a 5-minute buffer before actual expiration for proactive refresh
        refresh_warning_at: Date.now() + (tokenResponse.expires_in - 300) * 1000,
      };
      localStorage.setItem('google_drive_token', JSON.stringify(tokenData));
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  private restoreStoredToken(): void {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const storedToken = localStorage.getItem('google_drive_token');
      if (!storedToken) return;

      const tokenData = JSON.parse(storedToken);

      if (Date.now() >= tokenData.expires_at) {
        localStorage.removeItem('google_drive_token');
        return;
      }

      window.gapi.client.setToken({
        access_token: tokenData.access_token,
      });
    } catch (error) {
      console.error('Failed to restore stored token:', error);
      localStorage.removeItem('google_drive_token');
    }
  }

  getTokenExpiryInfo(): TokenExpiryInfo {
    try {
      const storedToken = localStorage.getItem('google_drive_token');
      if (!storedToken) return { isNearExpiry: false };

      const tokenData = JSON.parse(storedToken);
      const expiresAt = tokenData.expires_at;
      const now = Date.now();
      const minutesUntilExpiry = Math.max(0, Math.floor((expiresAt - now) / 60000));

      return {
        isNearExpiry: now >= (tokenData.refresh_warning_at || expiresAt),
        expiresAt,
        minutesUntilExpiry,
      };
    } catch {
      return { isNearExpiry: false };
    }
  }

  private clearSession(): void {
    this.finishAccessTokenRequest(false);
    if (typeof window !== 'undefined' && window.gapi?.client) {
      window.gapi.client.setToken(null);
    }
    if (typeof localStorage !== 'undefined') localStorage.removeItem('google_drive_token');
  }

  private async runDriveRequest<T>(action: string, request: () => PromiseLike<T>): Promise<T> {
    const requestToken = window.gapi.client.getToken()?.access_token;
    try {
      return await request();
    } catch (error: any) {
      console.error(`Failed to ${action}:`, error);
      const apiError = error?.result?.error;
      if (error?.status === 401 || apiError?.code === 401) {
        const currentToken = window.gapi.client.getToken()?.access_token;
        if (currentToken === requestToken) {
          this.clearSession();
          throw new GoogleDriveAuthenticationError('Authentication expired. Please sign in again.');
        }
        throw new Error(`Failed to ${action}: credentials changed; please try again.`);
      }

      throw new Error(
        `Failed to ${action}: ${apiError?.message || error?.message || 'Unknown error'}`,
      );
    }
  }

  requestAccessToken(): Promise<boolean> {
    if (!this.tokenClient) {
      return Promise.reject(new Error('Google Drive is not ready'));
    }
    if (this.accessTokenPromise) return this.accessTokenPromise;

    let resolveRequest!: (success: boolean) => void;
    const request = new Promise<boolean>((resolve) => {
      resolveRequest = resolve;
    });
    this.accessTokenPromise = request;
    this.resolveAccessToken = resolveRequest;
    this.accessTokenTimeout = setTimeout(() => this.finishAccessTokenRequest(false), 120000);

    try {
      this.tokenClient.requestAccessToken();
    } catch (error) {
      console.error('Failed to open Google OAuth popup:', error);
      this.finishAccessTokenRequest(false);
    }

    return request;
  }

  private handleAccessTokenResponse(response: any): void {
    if (!this.resolveAccessToken) return;

    if (response.error) {
      console.error('Google OAuth failed:', response.error);
      this.finishAccessTokenRequest(false);
      return;
    }

    window.gapi.client.setToken({ access_token: response.access_token });
    this.storeToken(response);
    this.finishAccessTokenRequest(true);
  }

  private finishAccessTokenRequest(success: boolean): void {
    if (!this.resolveAccessToken) return;

    if (this.accessTokenTimeout) clearTimeout(this.accessTokenTimeout);
    const resolve = this.resolveAccessToken;
    this.accessTokenPromise = null;
    this.resolveAccessToken = null;
    this.accessTokenTimeout = null;
    resolve(success);
  }

  async signOut(): Promise<void> {
    try {
      await this.prepare();
      const token = window.gapi.client.getToken();
      if (token) window.google.accounts.oauth2.revoke(token.access_token);
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      this.clearSession();
    }
  }

  hasValidSession(): boolean {
    if (typeof localStorage === 'undefined') return false;

    try {
      const storedToken = localStorage.getItem('google_drive_token');
      if (!storedToken) return false;

      const tokenData = JSON.parse(storedToken);
      return Date.now() < tokenData.expires_at;
    } catch {
      return false;
    }
  }

  async listFolders(
    parentId?: string,
    pageToken?: string,
  ): Promise<{ folders: DriveFolder[]; nextPageToken?: string }> {
    await this.prepare();

    if (!this.hasValidSession()) {
      throw new GoogleDriveAuthenticationError('User not authenticated');
    }

    const folderQuery = parentId
      ? `mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`
      : `mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;

    const requestParams: any = {
      q: folderQuery,
      fields: 'files(id,name,parents),nextPageToken',
      orderBy: 'name',
      pageSize: 100,
    };

    if (pageToken) requestParams.pageToken = pageToken;
    const response: any = await this.runDriveRequest('list folders', () =>
      window.gapi.client.drive.files.list(requestParams),
    );

    return {
      folders: response.result.files || [],
      nextPageToken: response.result.nextPageToken,
    };
  }

  async createFolder(name: string, parentId?: string): Promise<DriveFolder> {
    await this.prepare();

    if (!this.hasValidSession()) {
      throw new GoogleDriveAuthenticationError('User not authenticated');
    }

    const fileMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId && { parents: [parentId] }),
    };
    const response: any = await this.runDriveRequest('create folder', () =>
      window.gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id,name,parents',
      }),
    );

    return response.result;
  }

  async createGoogleDoc(title: string, content: string, folderId?: string): Promise<DriveFile> {
    await this.prepare();

    if (!this.hasValidSession()) {
      throw new GoogleDriveAuthenticationError('User not authenticated');
    }

    const markdownHtml = this.md.render(content);
    const styledHtml = `
        <html>
          <head>
            <style>
              body { font-family: 'Calibri', sans-serif; font-size: 12pt; line-height: 1.5; }
              p { margin: 12pt 0; }
            </style>
          </head>
          <body>${markdownHtml}</body>
        </html>`;

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const fileMetadata = {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      ...(folderId && { parents: [folderId] }),
    };

    const multipartRequestBody = [
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(fileMetadata),
      delimiter,
      'Content-Type: text/html; charset=UTF-8\r\n\r\n',
      styledHtml,
      close_delim,
    ].join('');

    const request: any = await this.runDriveRequest('create Google Doc', () =>
      window.gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartRequestBody,
      }),
    );

    const fileResponse: any = await this.runDriveRequest('load created Google Doc', () =>
      window.gapi.client.drive.files.get({
        fileId: request.result.id,
        fields: 'id,name,mimeType,webViewLink',
      }),
    );

    return fileResponse.result;
  }
}
