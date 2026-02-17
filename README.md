# Gemini File Processor

A modern React application that processes large batches of `.txt` and `.docx` files using Google's Gemini AI with a queued, throttled workflow, and integrated Google Drive upload functionality.

## Features

- **Queue-Based Processing**: Upload any number of `.txt` or `.docx` files; processing runs in queued batches of 10 every 90 seconds
- **Real-time Streaming**: See AI responses stream in real-time as they're generated
- **Google Drive Integration**: Save processed content directly to Google Drive as formatted Google Docs
- **API Quota Monitoring**: Real-time visual tracking of Gemini API usage with model-specific limits
- **Modern UI**: Clean, responsive interface built with Tailwind CSS v4 and shadcn/ui components

## Tech Stack

- **Frontend**: React 19 + TypeScript + Next.js
- **AI**: Google Gemini 2.5 Flash via AI SDK (`@ai-sdk/google`)
- **UI**: Tailwind CSS v4 + shadcn/ui components + Radix UI primitives
- **Styling**: Modern CSS with Tailwind CSS v4
- **Build**: Next.js with path aliases and optimized builds

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- Google Gemini API key
- (Optional) Google Cloud credentials for Drive integration

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd gemini-file-processor
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your API keys:

   ```env
   MY_GEMINI_API_KEY=your_gemini_api_key_here
   # Optional: For Google Drive integration
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
   NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key_here
   # Optional: For API quota monitoring
   NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER=your_project_number_here
   GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Usage

### Basic File Processing

1. **Upload or Paste**: Select `.txt`/`.docx` files or paste text to create a `.txt` input
2. **Add Instructions**: Enter custom instructions for how you want the AI to process your files
3. **Process**: Click "Process Files" to start queued processing (batches of 10 every 90 seconds)
4. **View Results**: Watch as responses stream in real-time for each file

### Google Drive Integration & Quota Monitoring (Optional)

For detailed setup instructions, see [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md).

**Google Drive:**

1. **Connect**: Click "Connect to Google Drive" and authenticate
2. **Select Folder**: Choose or create a folder for saving processed files
3. **Upload**: After processing, customize document names and upload to Drive

**Quota Monitoring:**

1. **Real-time Tracking**: Visual progress bars show current API usage vs daily limits
2. **Model Selection**: Automatically tracks usage for the currently selected Gemini model
3. **Usage Warnings**: Color-coded indicators at 80% (orange) and 95% (red) usage levels
4. **Auto-refresh**: Updates every 5 minutes with manual refresh option

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run ts-check` - Check TypeScript types
- `npm run prettier` - Format code with Prettier
- `npm run prettier:check` - Check code formatting

## Architecture

The application follows a component-based architecture with:

- **src/app/page.tsx**: Main component managing file state and UI layout
- **FileUpload**: Handles file selection and validation
- **InstructionsPanel**: Input for processing instructions and controls
- **ResponseDisplay**: Single file response viewer
- **MultiFileResponseDisplay**: Multi-file response viewer with queue/batch status
- **GoogleDriveUpload**: Optional Google Drive integration component

### Key Features

- **Queue-Based Engine**: Files are processed in batches of 10 every 90 seconds
- **Streaming Responses**: Real-time updates via callback patterns
- **Error Handling**: Per-file error handling allows partial success
- **State Management**: Clean React state management with custom hooks
- **Quota Monitoring**: Real-time API usage tracking with Google Cloud integration
- **SSR-safe Hydration**: Prevents duplicate API requests on page reload

## Environment Variables

Required:

- `MY_GEMINI_API_KEY` - Your Google Gemini API key

Optional (for Google Drive integration):

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - OAuth 2.0 Client ID
- `NEXT_PUBLIC_GOOGLE_API_KEY` - Google API key with Drive/Docs access

Optional (for API quota monitoring):

- `NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER` - Google Cloud project number
- `GOOGLE_SERVICE_ACCOUNT_KEY` - Service account JSON key (as string)
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key file (alternative)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Run linting: `npm run lint`
5. Build and test: `npm run build`
6. Commit your changes: `git commit -m 'Add feature'`
7. Push to the branch: `git push origin feature-name`
8. Submit a pull request
