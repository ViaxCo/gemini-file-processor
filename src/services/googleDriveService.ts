import MarkdownIt from 'markdown-it'

declare global {
  interface Window {
    google: any
    gapi: any
  }
}

export interface GoogleDriveConfig {
  clientId: string
  apiKey: string
}

export interface DriveFolder {
  id: string
  name: string
  parents?: string[]
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
}

export class GoogleDriveService {
  private config: GoogleDriveConfig
  private isGapiLoaded = false
  private isSignedIn = false
  private tokenClient: any = null
  private md = new MarkdownIt()

  // OAuth 2.0 scope for Google Drive
  private readonly DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
  private readonly SCOPES = 'https://www.googleapis.com/auth/drive'

  constructor(config: GoogleDriveConfig) {
    this.config = config
    this.initializeGapi()
  }

  private async initializeGapi(): Promise<void> {
    if (this.isGapiLoaded) return

    try {
      // Load Google API Client Library
      await this.loadScript('https://apis.google.com/js/api.js')
      
      // Wait for gapi to be available
      await this.waitForGapi()
      
      await this.loadScript('https://accounts.google.com/gsi/client')
      
      // Wait for google to be available
      await this.waitForGoogle()

      // Initialize gapi client
      await new Promise<void>((resolve, reject) => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: this.config.apiKey,
              discoveryDocs: [this.DISCOVERY_DOC]
            })

            // Initialize Google Identity Services
            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: this.config.clientId,
              scope: this.SCOPES,
              callback: (response: any) => {
                if (response.error) {
                  console.error('Token client error:', response.error)
                  return
                }
                this.isSignedIn = true
                // Store the token for persistence
                this.storeToken(response)
              }
            })

            // Try to restore stored token
            this.restoreStoredToken()

            this.isGapiLoaded = true
            resolve()
          } catch (error) {
            reject(error)
          }
        })
      })
    } catch (error) {
      console.error('Error initializing GAPI:', error)
      throw new Error('Failed to initialize Google API')
    }
  }

  private waitForGapi(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 50
      let attempts = 0
      
      const checkGapi = () => {
        if (window.gapi) {
          resolve()
        } else if (attempts < maxAttempts) {
          attempts++
          setTimeout(checkGapi, 100)
        } else {
          reject(new Error('Google API (gapi) failed to load'))
        }
      }
      
      checkGapi()
    })
  }

  private waitForGoogle(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 50
      let attempts = 0
      
      const checkGoogle = () => {
        if (window.google && window.google.accounts) {
          resolve()
        } else if (attempts < maxAttempts) {
          attempts++
          setTimeout(checkGoogle, 100)
        } else {
          reject(new Error('Google Identity Services failed to load'))
        }
      }
      
      checkGoogle()
    })
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      const existingScript = document.querySelector(`script[src="${src}"]`)
      if (existingScript) {
        // If script is already loaded and the global objects exist, resolve immediately
        if (src.includes('api.js') && window.gapi) {
          resolve()
          return
        }
        if (src.includes('gsi/client') && window.google) {
          resolve()
          return
        }
      }

      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = () => {
        // Wait a bit for the script to initialize
        setTimeout(() => resolve(), 100)
      }
      script.onerror = (error) => {
        console.error(`Failed to load script: ${src}`, error)
        reject(new Error(`Failed to load script: ${src}`))
      }
      document.head.appendChild(script)
    })
  }

  private storeToken(tokenResponse: any): void {
    try {
      const tokenData = {
        access_token: tokenResponse.access_token,
        expires_at: Date.now() + (tokenResponse.expires_in * 1000),
        scope: tokenResponse.scope
      }
      localStorage.setItem('google_drive_token', JSON.stringify(tokenData))
    } catch (error) {
      console.error('Failed to store token:', error)
    }
  }

  private restoreStoredToken(): void {
    try {
      const storedToken = localStorage.getItem('google_drive_token')
      if (!storedToken) return

      const tokenData = JSON.parse(storedToken)
      
      // Check if token is still valid (not expired)
      if (Date.now() >= tokenData.expires_at) {
        localStorage.removeItem('google_drive_token')
        return
      }

      // Set the token in gapi client
      window.gapi.client.setToken({
        access_token: tokenData.access_token
      })
      
      this.isSignedIn = true
    } catch (error) {
      console.error('Failed to restore stored token:', error)
      localStorage.removeItem('google_drive_token')
    }
  }

  async signIn(): Promise<boolean> {
    await this.initializeGapi()
    
    try {
      if (!this.tokenClient) {
        throw new Error('Token client not initialized')
      }

      return new Promise((resolve) => {
        this.tokenClient.callback = (response: any) => {
          if (response.error) {
            console.error('Sign in failed:', response.error)
            resolve(false)
            return
          }
          this.isSignedIn = true
          // Store the token for persistence
          this.storeToken(response)
          resolve(true)
        }
        
        this.tokenClient.requestAccessToken()
      })
    } catch (error) {
      console.error('Sign in failed:', error)
      return false
    }
  }

  async signOut(): Promise<void> {
    if (!this.isGapiLoaded) return

    try {
      // Revoke the access token
      const token = window.gapi.client.getToken()
      if (token) {
        window.google.accounts.oauth2.revoke(token.access_token)
        window.gapi.client.setToken(null)
      }
      this.isSignedIn = false
      // Remove stored token
      localStorage.removeItem('google_drive_token')
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  isAuthenticated(): boolean {
    if (!this.isGapiLoaded) {
      // Check localStorage for stored token even if gapi isn't loaded yet
      const storedToken = localStorage.getItem('google_drive_token')
      return storedToken !== null
    }
    
    try {
      const token = window.gapi.client.getToken()
      
      // If we have a valid token, we're authenticated regardless of the isSignedIn flag
      const hasValidToken = token !== null && token.access_token
      
      // Update the internal flag if we have a token but flag is wrong
      if (hasValidToken && !this.isSignedIn) {
        this.isSignedIn = true
      }
      
      return hasValidToken
    } catch (error) {
      console.error('Error checking authentication token:', error)
      // Fallback to localStorage check
      const storedToken = localStorage.getItem('google_drive_token')
      return storedToken !== null
    }
  }

  async listFolders(parentId?: string, pageToken?: string): Promise<{ folders: DriveFolder[], nextPageToken?: string }> {
    await this.initializeGapi()
    
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    try {
      let folderQuery: string
      
      if (parentId) {
        // If we have a parentId, get folders in that specific folder
        folderQuery = `mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`
      } else {
        // For root level, only show folders in 'My Drive' (not shared drives, computers, etc.)
        // This excludes folders that have parents, showing only top-level folders in My Drive
        folderQuery = `mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`
      }
      
      const requestParams: any = {
        q: folderQuery,
        fields: 'files(id,name,parents),nextPageToken',
        orderBy: 'name',
        pageSize: 100 // Increased to reduce API calls
      }
      
      if (pageToken) {
        requestParams.pageToken = pageToken
      }
      
      const response = await window.gapi.client.drive.files.list(requestParams)

      return {
        folders: response.result.files || [],
        nextPageToken: response.result.nextPageToken
      }
    } catch (error) {
      console.error('Error listing folders:', error)
      
      if (error?.code === 403) {
        throw new Error('Access denied. Check API permissions and quotas.')
      } else if (error?.code === 401) {
        throw new Error('Authentication expired. Please sign in again.')
      }
      
      throw new Error(`Failed to list folders: ${error?.message || 'Unknown error'}`)
    }
  }

  async createFolder(name: string, parentId?: string): Promise<DriveFolder> {
    await this.initializeGapi()
    
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    try {
      const fileMetadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId && { parents: [parentId] })
      }

      const response = await window.gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id,name,parents'
      })

      return response.result
    } catch (error) {
      console.error('Error creating folder:', error)
      throw new Error('Failed to create folder')
    }
  }

  async createGoogleDoc(
    title: string,
    content: string,
    folderId?: string
  ): Promise<DriveFile> {
    await this.initializeGapi()
    
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    try {
      const markdownHtml = this.md.render(content)
      const styledHtml = `
        <html>
          <head>
            <style>
              body {
                font-family: 'Calibri', sans-serif;
                font-size: 12pt;
                text-align: justify;
                line-height: 1.5;
              }
            </style>
          </head>
          <body>
            ${markdownHtml}
          </body>
        </html>
      `

      const boundary = '-------314159265358979323846'
      const delimiter = `\r\n--${boundary}\r\n`
      const close_delim = `\r\n--${boundary}--`

      const fileMetadata = {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
        ...(folderId && { parents: [folderId] }),
      }

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        'Content-Type: text/html; charset=UTF-8\r\n\r\n' +
        styledHtml +
        close_delim

      const request = window.gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      })

      const response = await request
      
      // Get the document info
      const fileResponse = await window.gapi.client.drive.files.get({
        fileId: response.result.id,
        fields: 'id,name,mimeType,webViewLink'
      })

      return fileResponse.result
    } catch (error) {
      console.error('Error creating Google Doc:', error)
      throw new Error('Failed to create Google Doc')
    }
  }

  async searchFiles(query: string, folderId?: string): Promise<DriveFile[]> {
    await this.initializeGapi()
    
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    try {
      let searchQuery = `name contains '${query}' and trashed=false`
      if (folderId) {
        searchQuery += ` and '${folderId}' in parents`
      }

      const response = await window.gapi.client.drive.files.list({
        q: searchQuery,
        fields: 'files(id,name,mimeType,webViewLink)',
        orderBy: 'modifiedTime desc'
      })

      return response.result.files || []
    } catch (error) {
      console.error('Error searching files:', error)
      throw new Error('Failed to search files')
    }
  }
}
