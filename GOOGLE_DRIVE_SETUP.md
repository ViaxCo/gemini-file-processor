# Google Drive Integration Setup Guide

This guide will help you set up Google Drive integration for your Gemini File Processor app, allowing you to:

- Connect to your Google Drive account
- Select specific folders for saving processed files
- Upload files as Google Docs with custom names
- Convert markdown content to Google Docs format

## Prerequisites

- Google Cloud Console account
- Basic understanding of environment variables

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID for later use

### 2. Enable Required APIs

1. In the Google Cloud Console, navigate to "APIs & Services" > "Library"
2. Search for and enable the following APIs:
   - **Google Drive API**
   - **Google Docs API**

### 3. Create Credentials

#### Create an API Key

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API key"
3. Copy the generated API key
4. (Optional) Restrict the API key to only the Drive and Docs APIs for security

#### Create OAuth 2.0 Client ID

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure the consent screen if prompted:
   - Choose "External" for user type
   - Fill in required fields (App name, User support email, Developer contact)
   - Add your email to test users if in development
4. Choose "Web application" as the application type
5. Add authorized JavaScript origins:
   - For development: `http://localhost:5173`
   - For production: Your domain (e.g., `https://yourdomain.com`)
6. **Important**: No need to add redirect URIs as the new Google Identity Services handles authentication differently
7. Copy the Client ID

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your credentials:
   ```env
   # Google Drive API Configuration
   VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
   VITE_GOOGLE_API_KEY=your_google_api_key_here
   # Note: VITE_GOOGLE_REDIRECT_URI is no longer needed with Google Identity Services
   
   # Gemini API Key (existing)
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

   Replace:
   - `your_google_client_id_here` with your OAuth 2.0 Client ID
   - `your_google_api_key_here` with your API key
   - `your_gemini_api_key_here` with your existing Gemini API key

   **Note**: The redirect URI is no longer needed as Google Identity Services handles authentication popups automatically.

### 5. Test the Integration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:5173`

3. You should see a "Connect to Google Drive" section

4. Click "Connect to Google Drive" to test the authentication

## How to Use

### Authentication
1. Click the "Connect to Google Drive" button
2. A Google OAuth popup will appear
3. Grant the necessary permissions
4. The app will show "Connected to Google Drive" when successful

### Selecting Folders
1. After authentication, use the folder selector to browse your Drive
2. Navigate through folders using the chevron buttons
3. Click "Select" on the desired folder
4. You can also create new folders directly from the interface

### Uploading Files
1. Process your files with Gemini AI as usual
2. Once processing is complete, the Google Drive upload section will appear
3. Customize the document names for each file
4. Choose to upload individual files or batch upload all files
5. Files will be saved as Google Docs in your selected folder

### Features
- **Markdown Conversion**: Automatically converts markdown-like content (headers, bullet points) to Google Docs format
- **Custom Naming**: Set custom names for each uploaded document
- **Folder Organization**: Save files to specific folders or create new ones
- **Batch Upload**: Upload multiple files at once
- **Direct Links**: Get direct links to view uploaded documents

## Troubleshooting

### Common Issues

**"Authentication failed" error:**
- Ensure your Client ID and API key are correct
- Check that the APIs are enabled in Google Cloud Console
- Verify the authorized JavaScript origins include your domain

**"Failed to list folders" error:**
- Make sure the Google Drive API is enabled
- Check that your API key has the correct permissions
- Ensure the user has granted the necessary OAuth scopes

**"Failed to create Google Doc" error:**
- Verify the Google Docs API is enabled
- Check that your API key includes access to the Docs API
- Ensure the user has write permissions to the selected folder

### Development vs Production

For production deployment, remember to:
1. Update the authorized JavaScript origins in Google Cloud Console
2. Update the `VITE_GOOGLE_REDIRECT_URI` environment variable
3. Consider restricting your API key to specific referrers for security

## Security Best Practices

1. **Restrict API Keys**: Limit your API key to only the necessary APIs and referrers
2. **OAuth Scopes**: The app only requests minimal necessary scopes (drive.file and documents)
3. **Environment Variables**: Never commit your `.env` file to version control
4. **HTTPS**: Use HTTPS in production for secure OAuth flows

## Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Verify all environment variables are set correctly
3. Ensure all required APIs are enabled in Google Cloud Console
4. Check that your OAuth consent screen is properly configured

The Google Drive integration enhances your file processing workflow by automatically saving processed content to your preferred Google Drive location in a properly formatted Google Docs format.