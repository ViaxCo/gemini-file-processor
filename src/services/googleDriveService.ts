import MarkdownIt from 'markdown-it';

declare global {
  interface Window {
    google: any;
  }
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

type UploadPhase = 'uploading' | 'verifying';

export class GoogleDriveAuthenticationError extends Error {}
export class GoogleDriveUnknownUploadError extends Error {}

class GoogleDriveHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type StoredToken = {
  access_token: string;
  expires_at: number;
  refresh_warning_at: number;
  scope?: string;
};

type CreateFolderOptions = {
  fileId?: string;
  onFileIdReserved?: (fileId: string) => void;
};

type CreateGoogleDocOptions = {
  operationKey?: string;
  reconcileOnly?: boolean;
  onOperationKeyCreated?: (operationKey: string) => void;
  onPhaseChange?: (phase: UploadPhase) => void;
};

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_STORAGE_KEY = 'google_drive_token';
const READ_TIMEOUT_MS = 15000;
const WRITE_TIMEOUT_MS = 30000;
const UPLOAD_OPERATION_PROPERTY = 'geminiFileProcessorUploadId';
const UNKNOWN_UPLOAD_MESSAGE = 'Drive could not confirm this upload. Check again before retrying.';

export class GoogleDriveService {
  private initializationPromise: Promise<void> | null = null;
  private accessTokenPromise: Promise<boolean> | null = null;
  private resolveAccessToken: ((success: boolean) => void) | null = null;
  private accessTokenTimeout: ReturnType<typeof setTimeout> | null = null;
  private tokenClient: any = null;
  private md = new MarkdownIt();

  private readonly SCOPES = 'https://www.googleapis.com/auth/drive';

  constructor(private clientId: string) {}

  prepare(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Google Drive is only available in the browser'));
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeGoogleIdentity().catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    }

    return this.initializationPromise;
  }

  private async initializeGoogleIdentity(): Promise<void> {
    try {
      await this.loadScript(
        'https://accounts.google.com/gsi/client',
        () => !!window.google?.accounts,
      );

      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: this.SCOPES,
        callback: (response: any) => this.handleAccessTokenResponse(response),
        error_callback: (error: any) => {
          console.error('Google OAuth popup failed:', error?.type || error);
          this.finishAccessTokenRequest(false);
        },
      });
    } catch (error) {
      console.error('Error initializing Google Identity Services:', error);
      throw new Error('Failed to initialize Google Drive');
    }
  }

  private loadScript(src: string, isLoaded: () => boolean): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.reject(new Error('Cannot load scripts during server-side rendering'));
    }
    if (isLoaded()) return Promise.resolve();

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
        if (!isLoaded()) return;
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

  private getTokenStorage(): Storage | null {
    try {
      return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      return null;
    }
  }

  private removeStoredToken(): void {
    try {
      this.getTokenStorage()?.removeItem(TOKEN_STORAGE_KEY);
    } catch {}
  }

  private readStoredToken(): StoredToken | null {
    const storage = this.getTokenStorage();
    if (!storage) return null;

    let storedToken: string | null;
    try {
      storedToken = storage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
    if (!storedToken) return null;

    try {
      const token = JSON.parse(storedToken) as StoredToken;
      if (!token.access_token || Date.now() >= token.expires_at) {
        this.removeStoredToken();
        return null;
      }
      return token;
    } catch {
      this.removeStoredToken();
      return null;
    }
  }

  private storeToken(response: any): boolean {
    const storage = this.getTokenStorage();
    if (!storage) return false;

    try {
      const expiresIn = Number(response.expires_in);
      const token: StoredToken = {
        access_token: response.access_token,
        expires_at: Date.now() + expiresIn * 1000,
        refresh_warning_at: Date.now() + Math.max(0, expiresIn - 300) * 1000,
        scope: response.scope,
      };
      storage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
      return true;
    } catch (error) {
      console.error('Failed to store Google Drive token:', error);
      return false;
    }
  }

  getTokenExpiryInfo(): TokenExpiryInfo {
    const token = this.readStoredToken();
    if (!token) return { isNearExpiry: false };

    const minutesUntilExpiry = Math.max(0, Math.floor((token.expires_at - Date.now()) / 60000));
    return {
      isNearExpiry: Date.now() >= token.refresh_warning_at,
      expiresAt: token.expires_at,
      minutesUntilExpiry,
    };
  }

  private clearSession(): void {
    this.finishAccessTokenRequest(false);
    this.removeStoredToken();
  }

  private async request<T>(
    action: string,
    url: string,
    init: RequestInit = {},
    timeoutMs = READ_TIMEOUT_MS,
    retryStaleToken = true,
  ): Promise<T> {
    const token = this.readStoredToken();
    if (!token) throw new GoogleDriveAuthenticationError('User not authenticated');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          ...init.headers,
        },
        signal: controller.signal,
      });

      if (response.status === 401) {
        const currentToken = this.readStoredToken();
        if (currentToken && currentToken.access_token !== token.access_token) {
          if (retryStaleToken) {
            return this.request<T>(action, url, init, timeoutMs, false);
          }
          throw new Error(`${action} used outdated credentials. Please try again.`);
        }
        this.clearSession();
        throw new GoogleDriveAuthenticationError('Authentication expired. Please sign in again.');
      }

      if (!response.ok) {
        let message = response.statusText || 'Unknown error';
        try {
          const body = await response.json();
          message = body?.error?.message || message;
        } catch {}
        throw new GoogleDriveHttpError(`${action} failed: ${message}`, response.status);
      }

      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error) {
      if (
        error instanceof GoogleDriveAuthenticationError ||
        error instanceof GoogleDriveHttpError
      ) {
        throw error;
      }
      if (controller.signal.aborted) throw new Error(`${action} timed out`);
      throw new Error(
        `${action} failed: ${error instanceof Error ? error.message : 'Network error'}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  requestAccessToken(): Promise<boolean> {
    if (!this.tokenClient) return Promise.reject(new Error('Google Drive is not ready'));
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

    this.finishAccessTokenRequest(this.storeToken(response));
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
    const token = this.readStoredToken();
    try {
      if (token && window.google?.accounts) {
        window.google.accounts.oauth2.revoke(token.access_token);
      }
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      this.clearSession();
    }
  }

  hasValidSession(): boolean {
    return !!this.readStoredToken();
  }

  async validateSession(): Promise<void> {
    await this.prepare();
    const params = new URLSearchParams({ fields: 'id' });
    await this.request<{ id: string }>(
      'Verifying Google Drive session',
      `${DRIVE_API_URL}/files/root?${params}`,
    );
  }

  async listFolders(
    parentId?: string,
    pageToken?: string,
  ): Promise<{ folders: DriveFolder[]; nextPageToken?: string }> {
    await this.prepare();

    const query = parentId
      ? `mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`
      : `mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;
    const params = new URLSearchParams({
      q: query,
      fields: 'files(id,name,parents),nextPageToken',
      orderBy: 'name',
      pageSize: '100',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await this.request<{ files?: DriveFolder[]; nextPageToken?: string }>(
      'Loading folders',
      `${DRIVE_API_URL}/files?${params}`,
    );
    return {
      folders: response.files || [],
      nextPageToken: response.nextPageToken,
    };
  }

  private async generateFileId(): Promise<string> {
    const params = new URLSearchParams({ count: '1', space: 'drive', type: 'files' });
    const response = await this.request<{ ids?: string[] }>(
      'Reserving Google Drive file',
      `${DRIVE_API_URL}/files/generateIds?${params}`,
    );
    const fileId = response.ids?.[0];
    if (!fileId) throw new Error('Google Drive did not reserve a file ID');
    return fileId;
  }

  private async findFolder(fileId: string): Promise<DriveFolder | null> {
    const params = new URLSearchParams({ fields: 'id,name,parents' });
    try {
      return await this.request<DriveFolder>(
        'Verifying folder',
        `${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}?${params}`,
      );
    } catch (error) {
      if (error instanceof GoogleDriveHttpError && error.status === 404) return null;
      throw error;
    }
  }

  async createFolder(
    name: string,
    parentId?: string,
    options: CreateFolderOptions = {},
  ): Promise<DriveFolder> {
    await this.prepare();

    const fileId = options.fileId || (await this.generateFileId());
    options.onFileIdReserved?.(fileId);
    if (options.fileId) {
      const existingFolder = await this.findFolder(fileId);
      if (existingFolder) return existingFolder;
    }

    const params = new URLSearchParams({ fields: 'id,name,parents' });
    try {
      return await this.request<DriveFolder>(
        'Creating folder',
        `${DRIVE_API_URL}/files?${params}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: fileId,
            name,
            mimeType: 'application/vnd.google-apps.folder',
            ...(parentId && { parents: [parentId] }),
          }),
        },
        WRITE_TIMEOUT_MS,
      );
    } catch (createError) {
      if (createError instanceof GoogleDriveAuthenticationError) throw createError;
      try {
        const existingFolder = await this.findFolder(fileId);
        if (existingFolder) return existingFolder;
      } catch (verificationError) {
        if (verificationError instanceof GoogleDriveAuthenticationError) throw verificationError;
      }
      throw createError;
    }
  }

  private async findFileByOperationKey(operationKey: string): Promise<DriveFile | null> {
    const query = `appProperties has { key='${UPLOAD_OPERATION_PROPERTY}' and value='${operationKey}' } and trashed=false`;
    const params = new URLSearchParams({
      q: query,
      fields: 'files(id,name,mimeType,webViewLink)',
      pageSize: '1',
      spaces: 'drive',
    });
    const response = await this.request<{ files?: DriveFile[] }>(
      'Verifying Google Doc',
      `${DRIVE_API_URL}/files?${params}`,
    );
    return response.files?.[0] || null;
  }

  private async reconcileGoogleDoc(operationKey: string): Promise<DriveFile | null> {
    for (const delay of [500, 1500]) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      const file = await this.findFileByOperationKey(operationKey);
      if (file) return file;
    }
    return null;
  }

  async createGoogleDoc(
    title: string,
    content: string,
    folderId?: string,
    options: CreateGoogleDocOptions = {},
  ): Promise<DriveFile> {
    await this.prepare();

    const operationKey = options.operationKey || crypto.randomUUID();
    options.onOperationKeyCreated?.(operationKey);

    if (options.operationKey) {
      options.onPhaseChange?.('verifying');
      try {
        const existingFile = await this.findFileByOperationKey(operationKey);
        if (existingFile) return existingFile;
        if (options.reconcileOnly) {
          throw new GoogleDriveUnknownUploadError(UNKNOWN_UPLOAD_MESSAGE);
        }
      } catch (error) {
        if (
          error instanceof GoogleDriveAuthenticationError ||
          error instanceof GoogleDriveUnknownUploadError
        ) {
          throw error;
        }
        throw new GoogleDriveUnknownUploadError(UNKNOWN_UPLOAD_MESSAGE);
      }
    }

    options.onPhaseChange?.('uploading');
    const markdownHtml = this.md.render(content);
    const styledHtml = `<html>
      <head>
        <style>
          body { font-family: 'Calibri', sans-serif; font-size: 12pt; line-height: 1.5; }
          p { margin: 12pt 0; }
        </style>
      </head>
      <body>${markdownHtml}</body>
    </html>`;
    const boundary = `drive-upload-${crypto.randomUUID()}`;
    const metadata = {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      appProperties: { [UPLOAD_OPERATION_PROPERTY]: operationKey },
      ...(folderId && { parents: [folderId] }),
    };
    const body = [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      'Content-Type: text/html; charset=UTF-8\r\n\r\n',
      styledHtml,
      `\r\n--${boundary}--`,
    ].join('');
    const params = new URLSearchParams({
      uploadType: 'multipart',
      fields: 'id,name,mimeType,webViewLink',
    });

    try {
      return await this.request<DriveFile>(
        'Uploading Google Doc',
        `${DRIVE_UPLOAD_URL}/files?${params}`,
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        },
        WRITE_TIMEOUT_MS,
      );
    } catch (uploadError) {
      if (uploadError instanceof GoogleDriveAuthenticationError) throw uploadError;
      if (uploadError instanceof GoogleDriveHttpError && uploadError.status < 500) {
        throw uploadError;
      }

      options.onPhaseChange?.('verifying');
      try {
        const existingFile = await this.reconcileGoogleDoc(operationKey);
        if (existingFile) return existingFile;
      } catch {
        throw new GoogleDriveUnknownUploadError(UNKNOWN_UPLOAD_MESSAGE);
      }

      throw new GoogleDriveUnknownUploadError(UNKNOWN_UPLOAD_MESSAGE);
    }
  }
}
