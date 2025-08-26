# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` - Build the application (always run this to ensure everything is working)
- `npm run lint` - Lint the codebase with ESLint
- `npm run preview` - Preview the built application
- `npm run dev` - Development server (don't run this, user runs it themselves)

## Architecture

This is a React + TypeScript + Vite application that processes files using Google's Gemini AI. The app allows users to upload multiple files, process them in parallel with custom instructions, and optionally upload the results to Google Drive as Google Docs.

### Key Components Architecture

- **App.tsx** - Main component that conditionally renders single-file vs multi-file layouts
- **FileUpload** - Handles file selection and validation (up to 10 files, text files only)
- **InstructionsPanel** - Contains instruction input and process/clear controls
- **ResponseDisplay** - Shows AI response for single file processing
- **MultiFileResponseDisplay** - Shows AI responses for multiple files in parallel
- **GoogleDriveUpload** - Handles uploading processed files to Google Drive as Google Docs
- **GoogleDriveAuth** - Manages Google Drive authentication
- **GoogleDriveFolderSelector** - Allows users to select target folders in Google Drive

### Data Flow

1. Files are managed in App.tsx state and passed down to components
2. `useAIProcessor` hook manages file processing state and coordinates parallel AI calls
3. `aiService.ts` handles the actual Gemini API integration using AI SDK
4. Results stream back in real-time via the `onChunk` callback pattern
5. `useGoogleDrive` hook manages Google Drive authentication and upload operations
6. Processed files can be uploaded to Google Drive as Google Docs with markdown formatting

### File Processing System

The app processes files in parallel using Promise.all:

- Each file gets its own FileResult with processing state
- Streaming responses update the UI in real-time
- Error handling is per-file, allowing partial success

### Tech Stack

- **UI**: React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui components
- **Build**: Vite with path aliases (`@/` → `./src/`)
- **AI**: Google Gemini 2.5 Flash via AI SDK (`@ai-sdk/google`)
- **Styling**: Tailwind CSS v4 with Radix UI primitives

### Environment

Required environment variables:

- `VITE_GEMINI_API_KEY` - Google Gemini API key for AI processing
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID for Drive integration
- `VITE_GOOGLE_API_KEY` - Google API key for Drive API access

See `GOOGLE_DRIVE_SETUP.md` for detailed Google Drive setup instructions.

## Development Notes

- Use context7 to look up documentation for all packages
- Don't run the dev server or preview (user runs it themselves)
- Use browser MCP for debugging browser issues
- Only stage changes when explicitly requested
- Only commit when explicitly requested
- Always run build to ensure everything is working fine
- when i say look at the browser, i mean the tab is already loaded with the page. don't navigate there
- When using shadcn components, use the MCP
  server.
  - Apply components wherever components are applicable. Use whole blocks where possible (e.g., login page,
    calendar)
  - When implementing: First call the demo tool to see how it is used. Then implement it so that it is implemented correctly
