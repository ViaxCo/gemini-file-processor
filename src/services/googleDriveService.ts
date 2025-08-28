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

export class GoogleDriveService {
  private config: GoogleDriveConfig;
  private initializationPromise: Promise<void> | null = null;
  private isSignedIn = false;
  private tokenClient: any = null;
  private md = new MarkdownIt();

  private readonly DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  private readonly SCOPES = 'https://www.googleapis.com/auth/drive';

  constructor(config: GoogleDriveConfig) {
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    if (this.initializationPromise) {
      return;
    }
    this.initializationPromise = this._initializeGapi();
  }

  private async _initializeGapi(): Promise<void> {
    try {
      await this.loadScript('https://apis.google.com/js/api.js', () => !!window.gapi);
      await this.loadScript(
        'https://accounts.google.com/gsi/client',
        () => !!window.google?.accounts,
      );

      await new Promise<void>((resolve, reject) => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: this.config.apiKey,
              discoveryDocs: [this.DISCOVERY_DOC],
            });

            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: this.config.clientId,
              scope: this.SCOPES,
              callback: (response: any) => {
                if (response.error) {
                  console.error('Token client error:', response.error);
                  return;
                }
                this.isSignedIn = true;
                this.storeToken(response);
              },
            });

            this.restoreStoredToken();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error initializing GAPI:', error);
      this.initializationPromise = null; // Allow retry on failure
      throw new Error('Failed to initialize Google API');
    }
  }

  private loadScript(src: string, isLoadedCheck: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        if (isLoadedCheck()) {
          resolve();
          return;
        }
        // If script exists but global object isn't ready, poll for it
        const interval = setInterval(() => {
          if (isLoadedCheck()) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (error) => {
        console.error(`Failed to load script: ${src}`, error);
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  private storeToken(tokenResponse: any): void {
    try {
      const tokenData = {
        access_token: tokenResponse.access_token,
        expires_at: Date.now() + tokenResponse.expires_in * 1000,
        scope: tokenResponse.scope,
      };
      localStorage.setItem('google_drive_token', JSON.stringify(tokenData));
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  private restoreStoredToken(): void {
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

      this.isSignedIn = true;
    } catch (error) {
      console.error('Failed to restore stored token:', error);
      localStorage.removeItem('google_drive_token');
    }
  }

  async signIn(): Promise<boolean> {
    await this.initializationPromise;

    try {
      if (!this.tokenClient) {
        throw new Error('Token client not initialized');
      }

      return new Promise((resolve) => {
        this.tokenClient.callback = (response: any) => {
          if (response.error) {
            console.error('Sign in failed:', response.error);
            resolve(false);
            return;
          }
          this.isSignedIn = true;
          this.storeToken(response);
          resolve(true);
        };

        this.tokenClient.requestAccessToken();
      });
    } catch (error) {
      console.error('Sign in failed:', error);
      return false;
    }
  }

  async signOut(): Promise<void> {
    await this.initializationPromise;

    try {
      const token = window.gapi.client.getToken();
      if (token) {
        window.google.accounts.oauth2.revoke(token.access_token);
        window.gapi.client.setToken(null);
      }
      this.isSignedIn = false;
      localStorage.removeItem('google_drive_token');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }

  isAuthenticated(): boolean {
    const storedToken = localStorage.getItem('google_drive_token');
    if (!storedToken) return false;

    try {
      const tokenData = JSON.parse(storedToken);
      if (Date.now() >= tokenData.expires_at) {
        localStorage.removeItem('google_drive_token');
        return false;
      }
      // If gapi is loaded, also update its internal state
      if (window.gapi?.client) {
        window.gapi.client.setToken({ access_token: tokenData.access_token });
        this.isSignedIn = true;
      }
      return true;
    } catch {
      localStorage.removeItem('google_drive_token');
      return false;
    }
  }

  async listFolders(
    parentId?: string,
    pageToken?: string,
  ): Promise<{ folders: DriveFolder[]; nextPageToken?: string }> {
    await this.initializationPromise;

    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const folderQuery = parentId
        ? `mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`
        : `mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;

      const requestParams: any = {
        q: folderQuery,
        fields: 'files(id,name,parents),nextPageToken',
        orderBy: 'name',
        pageSize: 100,
      };

      if (pageToken) {
        requestParams.pageToken = pageToken;
      }

      const response = await window.gapi.client.drive.files.list(requestParams);

      return {
        folders: response.result.files || [],
        nextPageToken: response.result.nextPageToken,
      };
    } catch (error: any) {
      console.error('Error listing folders:', error);
      if (error?.result?.error?.code === 401) {
        this.signOut(); // Force sign out on auth error
        throw new Error('Authentication expired. Please sign in again.');
      }
      throw new Error(
        `Failed to list folders: ${error?.result?.error?.message || 'Unknown error'}`,
      );
    }
  }

  async createFolder(name: string, parentId?: string): Promise<DriveFolder> {
    await this.initializationPromise;

    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const fileMetadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId && { parents: [parentId] }),
      };

      const response = await window.gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id,name,parents',
      });

      return response.result;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw new Error('Failed to create folder');
    }
  }

  async createGoogleDoc(title: string, content: string, folderId?: string): Promise<DriveFile> {
    await this.initializationPromise;

    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
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

      const request = await window.gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartRequestBody,
      });

      const fileResponse = await window.gapi.client.drive.files.get({
        fileId: request.result.id,
        fields: 'id,name,mimeType,webViewLink',
      });

      return fileResponse.result;
    } catch (error) {
      console.error('Error creating Google Doc:', error);
      throw new Error('Failed to create Google Doc');
    }
  }
}
