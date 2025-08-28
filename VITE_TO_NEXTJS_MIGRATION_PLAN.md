# Vite to Next.js Migration Plan

## Phase 1: Core Infrastructure Setup

1. **Install Next.js dependencies**
   - Add `next@latest` as main dependency
   - Keep React 19 and existing UI libraries
   - Remove Vite-specific dependencies (`vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`)

2. **Create Next.js configuration**
   - Create `next.config.mjs` with SPA export mode initially
   - Configure path aliases (`@/` → `./src/`)
   - Set custom dist directory to maintain build output location

3. **Update TypeScript configuration**
   - Modify `tsconfig.json` with Next.js-specific compiler options
   - Add Next.js types and plugins
   - Update include/exclude patterns

## Phase 2: App Structure Migration

4. **Convert to Next.js App Router structure**
   - Create `src/app/layout.tsx` as root layout (migrate from index.html)
   - Create `src/app/globals.css` with Tailwind imports (migrate from src/index.css)
   - Create `src/app/page.tsx` as main application page (simplified from [[...slug]])
   - Move current App.tsx logic into the page component

5. **Update environment variables**
   - Rename `VITE_GEMINI_API_KEY` → `NEXT_PUBLIC_GEMINI_API_KEY`
   - Rename `VITE_GOOGLE_CLIENT_ID` → `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - Rename `VITE_GOOGLE_API_KEY` → `NEXT_PUBLIC_GOOGLE_API_KEY`

## Phase 3: Build System Migration

6. **Configure Tailwind CSS for Next.js**
   - Install `@tailwindcss/postcss` dependency
   - Create `postcss.config.mjs` with `@tailwindcss/postcss` plugin
   - Update CSS imports to use `@import "tailwindcss"` in globals.css
   - Keep all existing CSS custom properties and theme variables

7. **Update package.json scripts**
   - Replace Vite commands with Next.js equivalents:
     - `"dev": "next dev"`
     - `"build": "next build"`
     - `"preview": "next start"`
   - Keep ESLint and Prettier configurations

8. **Handle static assets**
   - Move public folder contents (ensure compatibility)
   - Update any hardcoded Vite asset references
   - Update favicon and meta tags in layout.tsx

## Phase 4: Server-Side Rendering Compatibility

9. **Fix SSR issues**
   - Update GoogleDriveService to check for browser environment before accessing `document` and `localStorage`
   - Update useGoogleDrive hook to lazy initialize GoogleDriveService only in browser
   - Update theme-context.tsx to handle server-side rendering properly
   - Add browser environment checks for all localStorage access

10. **Update configuration files**
    - Update `components.json` to reflect Next.js structure (`rsc: true`, updated CSS path)
    - Update `.prettierrc.json` to reflect new CSS path (`src/app/globals.css`)
    - Update `.gitignore` to include Next.js specific files (`.next/`, `out/`)

## Phase 5: Testing & Cleanup

11. **Verify core functionality**
    - Test file upload and AI processing
    - Verify Google Drive integration works
    - Ensure theme switching and instructions work
    - Test all shadcn/ui components render correctly

12. **Clean up legacy files**
    - Remove `index.html`, `vite.config.ts`, `vite-env.d.ts`
    - Remove `main.tsx` (logic moved to layout/page)
    - Remove `src/index.css` (replaced by app/globals.css)
    - Remove `src/App.tsx` (legacy Vite component)
    - Clean up package.json dependencies

## Additional Changes Made Beyond Original Plan

### Simplified Routing Structure
- **Original Plan**: Used complex `[[...slug]]` catch-all routing
- **Actual Implementation**: Simplified to standard `page.tsx` for single-page application

### Enhanced SSR Compatibility
- **Original Plan**: Basic SSR setup
- **Actual Implementation**: Comprehensive fixes for all browser API access during server-side rendering:
  - Added browser environment checks in GoogleDriveService
  - Updated useGoogleDrive hook for lazy initialization
  - Fixed theme context SSR issues
  - Added safe localStorage operations with environment checks

### Configuration Updates
- **Original Plan**: Basic configuration updates
- **Actual Implementation**: Updated multiple configuration files:
  - `components.json`: Updated for RSC and new CSS path
  - `.prettierrc.json`: Updated CSS path reference
  - `.gitignore`: Added Next.js specific ignores

## Benefits After Migration

- **Better SEO** potential with SSR/SSG options
- **Automatic code splitting** and performance optimizations
- **Built-in Image and Font optimization** capabilities
- **Middleware support** for advanced routing
- **Incremental adoption** of server components later

## Migration Strategy

- Start with **SPA mode** to maintain current client-side behavior
- **Preserve all existing features** and UI components
- **Minimal disruption** to current architecture patterns
- **Incremental enhancement** opportunities post-migration
