# Gemini File Processor

A modern React application that processes multiple files in parallel using Google's Gemini AI, with integrated Google Drive upload functionality.

## Features

- **Multi-file Processing**: Upload and process up to 10 text files simultaneously with custom instructions
- **Real-time Streaming**: See AI responses stream in real-time as they're generated
- **Google Drive Integration**: Save processed content directly to Google Drive as formatted Google Docs
- **Parallel Processing**: Process multiple files concurrently for maximum efficiency
- **Modern UI**: Clean, responsive interface built with Tailwind CSS v4 and shadcn/ui components

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **AI**: Google Gemini 2.5 Flash via AI SDK (`@ai-sdk/google`)
- **UI**: Tailwind CSS v4 + shadcn/ui components + Radix UI primitives
- **Styling**: Modern CSS with Tailwind CSS v4
- **Build**: Vite with path aliases and fast development

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- Google Gemini API key
- (Optional) Google Cloud credentials for Drive integration

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd upload-to-doc
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
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   # Optional: For Google Drive integration
   VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
   VITE_GOOGLE_API_KEY=your_google_api_key_here
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Usage

### Basic File Processing

1. **Upload Files**: Select up to 10 text files (supports .txt, .md, .json, .js, .ts, etc.)
2. **Add Instructions**: Enter custom instructions for how you want the AI to process your files
3. **Process**: Click "Process Files" to start parallel AI processing
4. **View Results**: Watch as responses stream in real-time for each file

### Google Drive Integration (Optional)

For detailed setup instructions, see [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md).

1. **Connect**: Click "Connect to Google Drive" and authenticate
2. **Select Folder**: Choose or create a folder for saving processed files
3. **Upload**: After processing, customize document names and upload to Drive

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Architecture

The application follows a component-based architecture with:

- **App.tsx**: Main component managing file state and UI layout
- **FileUpload**: Handles file selection and validation
- **InstructionsPanel**: Input for processing instructions and controls
- **ResponseDisplay**: Single file response viewer
- **MultiFileResponseDisplay**: Multi-file response viewer with parallel processing
- **GoogleDriveUpload**: Optional Google Drive integration component

### Key Features

- **Parallel Processing**: Files are processed concurrently using Promise.all
- **Streaming Responses**: Real-time updates via callback patterns
- **Error Handling**: Per-file error handling allows partial success
- **State Management**: Clean React state management with custom hooks

## Environment Variables

Required:

- `VITE_GEMINI_API_KEY` - Your Google Gemini API key

Optional (for Google Drive integration):

- `VITE_GOOGLE_CLIENT_ID` - OAuth 2.0 Client ID
- `VITE_GOOGLE_API_KEY` - Google API key with Drive/Docs access

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Run linting: `npm run lint`
5. Build and test: `npm run build`
6. Commit your changes: `git commit -m 'Add feature'`
7. Push to the branch: `git push origin feature-name`
8. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
