# Gemini File Processor

## IMPORTANT Guidelines

- Only stage changes when explicitly requested
- Only commit when explicitly requested
- NEVER run `npm run build`.
- Use shadcn/ui for all components.
- When using shadcn components, use the MCP server.
  - Prefer full blocks when applicable (e.g., login, calendar, dashboard).
  - Before implementing, call the demo tool to see correct usage and props.
- Every UI change must be mobile‑first and responsive.
- Use Context7 to look up documentation for every package you interact with.
- Only commit when explicitly requested.
- Always run `npm run pretest` after changes.
- Never start the dev server.
- Always implement simple code that is easy to read, understand and maintain.
- If a file gets too large, split it up into smaller pieces.

## Project Overview

This is a Next.js application that allows users to process large batches of `.txt` files using Google's Gemini AI. The application features a queue-based workflow, real-time streaming of AI responses, and integration with Google Drive for saving processed content. It also includes a real-time API quota monitoring system.

The frontend is built with React 19, TypeScript, and Next.js, and the UI is styled with Tailwind CSS v4 and shadcn/ui components. The backend is a Next.js API route that uses the `@ai-sdk/google` library to interact with the Gemini API.

## Building and Running

### Prerequisites

- Node.js (v18 or higher)
- Google Gemini API key
- (Optional) Google Cloud credentials for Drive integration

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd gemini-file-processor
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root of the project and add your API keys:

   ```env
   MY_GEMINI_API_KEY=your_gemini_api_key_here
   # Optional: For Google Drive integration
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
   NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key_here
   # Optional: For API quota monitoring
   NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER=your_project_number_here
   GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   ```

### Running the Application

- **Development:**

  ```bash
  npm run dev
  ```

  This will start the development server on `http://localhost:5173`.

- **Production Build:**

  ```bash
  npm run build
  ```

- **Preview Production Build:**

  ```bash
  npm run preview
  ```

### Testing and Linting

- **Run ESLint:**

  ```bash
  npm run lint
  ```

- **Check TypeScript types:**

  ```bash
  npm run ts-check
  ```

- **Format code with Prettier:**

  ```bash
  npm run prettier
  ```

- **Check code formatting:**

  ```bash
  npm run prettier:check
  ```

## Development Conventions

- **Component-Based Architecture:** The application follows a component-based architecture, with the main logic encapsulated in the `GeminiFileProcessor` component.
- **Custom Hooks:** Custom hooks are used to manage complex state and logic, such as AI processing (`useAIProcessor`), Google Drive integration (`useGoogleDrive`), and instructions management (`useInstructions`).
- **Styling:** The application uses Tailwind CSS v4 for styling, with shadcn/ui components for the UI.
- **State Management:** State is managed using a combination of `useState`, `useRef`, and custom hooks.
- **API Communication:** The frontend communicates with the backend via a Next.js API route. The backend then communicates with the Gemini API using the `@ai-sdk/google` library.
- **Error Handling:** The application has a robust error handling mechanism that includes retries with exponential backoff and confidence scoring to ensure the quality of the AI responses.
