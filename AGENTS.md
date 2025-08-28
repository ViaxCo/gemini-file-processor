# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` - Build for production (includes dependency install and TypeScript compilation)
- `npm run lint` - Lint the codebase with ESLint 9
- `npm run preview` - Preview the built application
- `npm run dev` - Development server (don't run this, user runs it themselves)
- `npm run prettier` - Format code with Prettier and Tailwind CSS plugin
- `npm run prettier:check` - Check code formatting without making changes
- `npm run ts-check` - Check TypeScript types

## Architecture

This is a **Gemini File Processor** - a modern React TypeScript application built with Next.js that processes multiple text files in parallel using Google's Gemini AI, with integrated Google Drive upload functionality.

### Core Architecture Pattern

The application follows a **component-based architecture** with custom hooks for business logic and React Context for global state management. Key architectural decisions:

- **Parallel Processing**: Files are processed concurrently using Promise.all with streaming AI responses
- **Real-time Updates**: AI responses stream in real-time using async generators and callback patterns
- **Error Isolation**: Per-file error handling allows partial success across batch operations
- **Mobile-First Design**: Built with Tailwind CSS v4 for responsive design

### Data Flow & State Management

1. **File Management**: App orchestrates file state and UI layout switching (single vs multi-file)
2. **AI Processing**: `useAIProcessor` hook coordinates parallel Gemini API calls via `aiService.ts`
3. **Streaming Responses**: Real-time updates through `onChunk` callback patterns
4. **Google Drive Integration**: `useGoogleDrive` hook manages OAuth authentication and document uploads
5. **Theme System**: Context-based dark/light mode with system preference detection
6. **Instructions Management**: `useInstructions` hook handles preset management and localStorage

### File Processing System

- **Concurrent Processing**: Up to 10 text files processed simultaneously
- **Streaming UI**: Each file gets its own FileResult with real-time processing state
- **Format Support**: .txt, .md, .json, .js, .ts, and other text-based files
- **Error Resilience**: Individual file failures don't block other files

### Tech Stack & Dependencies

- **Core**: React 19 + TypeScript 5.9 + Next.js 15 (ES modules, path aliases `@/` → `./src/`)
- **AI Integration**: Google Gemini 2.5 Flash via AI SDK (`@ai-sdk/google`, `ai` for streaming)
- **UI Framework**: Tailwind CSS v4 + shadcn/ui components + 12+ Radix UI primitives
- **Build Tools**: ESLint 9 + Prettier (with Tailwind plugin) + TypeScript strict mode
- **Additional**: Sonner notifications, Lucide React icons, markdown-it processing

### Environment Variables

**Required:**

- `NEXT_PUBLIC_GEMINI_API_KEY` - Google Gemini API key for AI processing

**Optional (for Google Drive integration):**

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - Google OAuth 2.0 client ID for Drive authentication
- `NEXT_PUBLIC_GOOGLE_API_KEY` - Google API key for Drive/Docs API access

**Note**: AI model selection is configurable through the UI (ModelSelector component) and persisted in localStorage. See `GOOGLE_DRIVE_SETUP.md` for detailed Google Drive API setup instructions.

## Development Notes

### Code Quality & Build Process

- **Pre-deployment checks**: Always run `npm run lint`, `npm run prettier`, `npm run ts-check`, and `npm run build` to ensure everything works and is properly formatted
- **TypeScript**: Strict mode enabled - all type errors must be resolved before building
- **No testing framework**: Project relies on TypeScript + ESLint for code quality and manual testing

### Component Development

- **shadcn/ui Integration**: Use the MCP server for shadcn components
  - First call the demo tool to understand correct usage patterns
  - Apply components wherever applicable; prefer whole blocks (e.g., login pages, calendars)
  - All UI components are in `src/components/ui/` with 12+ Radix primitives already integrated
- **Mobile-First**: Every UI change must be mobile-first responsive using Tailwind CSS v4
- **Theme Support**: All new components must support the existing dark/light theme system

### Development Workflow

- **Server Management**: Don't run dev server or preview (user manages this)
- **Browser Debugging**: Use browser mcp for this. When referenced, browser tab is already loaded - don't navigate
- **Git Operations**: Only stage/commit changes when explicitly requested
- **Documentation**: Use context7 MCP server for package documentation lookup

### Architecture Guidelines

- **Custom Hooks Pattern**: Business logic belongs in custom hooks (`useAIProcessor`, `useGoogleDrive`, etc.)
- **Component Separation**: Keep components focused - file processing, UI display, and Google Drive integration are separate concerns
- **Error Handling**: Maintain per-file error isolation pattern for batch operations
- **State Management**: Use React Context only for truly global state (theme, instructions); prefer component state otherwise

## Key Implementation Details

### Performance Optimizations

- **Buffered Updates**: AI streaming responses are buffered to prevent excessive React re-renders (100ms intervals or 500 char buffers)
- **Idle Work Scheduling**: Non-critical UI updates use `requestIdleCallback` via `scheduleIdleWork` utility
- **Memory Management**: Response buffers are cleared after each flush to prevent memory leaks

### TypeScript Configuration

- **Project References**: Uses TypeScript project references pattern with separate configs for app (`tsconfig.app.json`) and Node.js (`tsconfig.node.json`)
- **Strict Mode**: Full TypeScript strict mode enabled with `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`
- **Path Aliases**: `@/*` maps to `./src/*` for clean imports

### ESLint Configuration

- **Modern Setup**: Uses ESLint 9 with flat config system (`eslint.config.js`)
- **React Integration**: Includes react-hooks and react-refresh plugins
- **Custom Rules**: Allows unused variables with uppercase names (constants pattern)

### State Persistence Patterns

- **Instructions Storage**: `useInstructions` hook manages localStorage for custom instructions with validation and limits
- **Theme Persistence**: Theme context automatically syncs with localStorage and system preferences
- **Model Selection**: Selected Gemini model persists across sessions via `useModelSelector` hook

### Error Handling Strategy

- **Per-File Isolation**: Individual file processing errors don't affect other files in batch operations
- **Graceful Degradation**: Google Drive features are optional - app works without API keys
- **Safe Storage Operations**: All localStorage operations wrapped in try-catch with fallbacks

### File Processing Pipeline

1. **Validation**: File type and size validation before processing
2. **Parallel Execution**: Up to 10 files processed simultaneously via Promise.all
3. **Streaming Updates**: Real-time UI updates via callback pattern with buffering
4. **Completion Tracking**: Individual file completion states for precise UI feedback
5. **Retry Logic**: Failed files can be retried individually or in batch

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
