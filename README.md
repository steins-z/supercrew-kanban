# supercrew-kanban

Kanban board for visualizing supercrew features and tasks.

## Architecture

- **Backend**: Hono on Bun (local dev) / Vercel serverless (production)
- **Frontend**: React + Vite + TanStack Router/Query, pnpm monorepo
- **Data**: GitHub Contents API (read/write `.supercrew/` files in user's repo)
- **Auth**: GitHub OAuth

## Quick Start

```bash
# Install all dependencies (root, backend, frontend)
pnpm install

# Set up environment
cp .env.example .env
cp backend/.env.example backend/.env
# Edit .env files with your GitHub OAuth credentials

# Run development server
pnpm dev
```

## Project Structure

```
supercrew-kanban/
├── api/              # Vercel serverless entry point
├── backend/          # Hono backend (Bun/Node)
├── frontend/         # React frontend (pnpm monorepo)
├── docs/             # Design docs and plans
├── scripts/          # Build/dev scripts
└── vercel.json       # Vercel deployment config
```

## Related

- [supercrew](https://github.com/steins-z/supercrew) - Claude Code skills/plugins
