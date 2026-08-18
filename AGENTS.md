## IMPORTANT Guidelines

- Use shadcn/ui for all components.
- When using shadcn components, use the MCP server.
  - Prefer full blocks when applicable (e.g., login, calendar, dashboard).
  - Before implementing, call the demo tool to see correct usage and props.
- Every UI change must be mobile‑first and responsive.
- Always run `npm run pretest` after changes.
- If a file gets too large, split it up into smaller pieces.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
