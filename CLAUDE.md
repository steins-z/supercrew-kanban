# SuperCrew Kanban — Agent Instructions

## Architecture

- **Backend**: Hono on Bun (local dev) / Vercel serverless (production)
- **Frontend**: React + Vite + TanStack Router/Query, pnpm monorepo
- **Auth**: GitHub OAuth → access_token stored in localStorage

## Vercel Deployment

- `api/index.ts` is the Vercel serverless entry point — uses `@hono/node-server/vercel` handler
- `hono`, `@hono/node-server`, and `@types/node` must be in root `dependencies` (not devDeps)
- `installCommand` uses `corepack enable && pnpm install`
- `buildCommand` filters to `@vibe/local-web` package

## Dual-Environment Notes

The backend runs on **Bun locally** and **Node.js on Vercel**.

- `@types/bun` masks missing `@types/node` — keep `@types/node` in **dependencies**
- `typescript` must be in backend **dependencies** — Vercel skips devDependencies
- `api/index.ts` must use dynamic `import()` — Vercel compiles to CJS, backend is ESM

## Verification Checklist (Before Deploy)

```bash
npm run typecheck           # Backend Node.js typecheck
```

## Key Files

| File                           | Purpose                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `api/index.ts`                 | Vercel serverless entry point (uses @hono/node-server/vercel)      |
| `vercel.json`                  | Build config + URL rewrites                                        |
| `backend/src/index.ts`         | Hono app with OAuth routes (/auth/github, /auth/callback, /health) |
| `frontend/packages/local-web/` | Main frontend app                                                  |
| `frontend/packages/app-core/`  | Shared hooks and API layer                                         |

## Common Mistakes to Avoid

1. Don't use static imports in `api/index.ts` — Vercel compiles to CJS, can't statically import ESM
2. Don't put type packages in devDependencies — Vercel won't install them
