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
cp frontend/packages/local-web/.env.example frontend/packages/local-web/.env.local
# Edit .env files with your GitHub OAuth credentials

# Run development server
pnpm dev
```

### Development Modes

The frontend supports two modes:

**1. GitHub API Mode (Default)**
- Fetches data from GitHub API
- Requires GitHub OAuth authentication
- Subject to API rate limits (5000 requests/hour)

**2. Local Git Mode (Development)**
- Reads data directly from local git repository
- No API calls, zero rate limit consumption
- Perfect for rapid iteration and testing

To enable local git mode, edit `frontend/packages/local-web/.env.local`:
```bash
VITE_DEV_MODE=local-git
```

To switch back to GitHub API mode, comment out or remove that line:
```bash
# VITE_DEV_MODE=local-git
```

**Note:** `.env.local` is git-ignored and won't affect production builds.

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
