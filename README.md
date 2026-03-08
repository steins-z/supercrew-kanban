# supercrew-kanban

Kanban board for visualizing supercrew features and tasks.

## Architecture

- **Backend**: Hono on Bun (local dev) / Vercel serverless (production)
- **Frontend**: React + Vite + TanStack Router/Query, pnpm monorepo
- **Data**: Hybrid Git + Database architecture
  - **Git**: Source of truth (`.supercrew/` files in user's repo)
  - **Database**: Real-time cache (Turso/libSQL)
  - **Sync**: Daily reconcile + continuous validation
- **Auth**: GitHub OAuth

### Data Sync Strategy

**Three Data Sources** (priority order):

1. **Git Origin** (highest accuracy) - Source of truth from GitHub branches
2. **Local Coding Agent** (highest timeliness) - Real-time POST callbacks during development
3. **Database** (best performance) - Validated cache for fast reads

**Sync Mechanisms:**

- **Daily Reconcile** (3:00 AM UTC) - Full Git scan → Database sync
- **Continuous Validation** (every minute) - Verify agent-reported features
- **Grace Window** (10 minutes) - Allow time for agent to push changes before marking orphaned

**Source Field States:**
- `git` - Synced from Git (verified truth)
- `agent` - Reported by agent (pending verification)
- `agent_verified` - Agent data verified against Git
- `agent_stale` - Agent data older than Git
- `agent_orphaned` - Agent push never happened (>10min grace window)

## Quick Start

```bash
# Install all dependencies (root, backend, frontend)
pnpm install

# Set up environment
cp .env.example .env
cp backend/.env.example backend/.env
# Edit .env files with your GitHub OAuth credentials and database URL

# Start local database (Turso/libSQL)
cd backend
turso dev --db-file kanban.db --port 8080

# Run development server (in another terminal)
pnpm dev
```

### Environment Variables

**Backend** (`backend/.env`):

```bash
# GitHub OAuth (required)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Database (required)
TURSO_DATABASE_URL=http://127.0.0.1:8080  # or your Turso cloud URL
TURSO_AUTH_TOKEN=dev-token                # or your Turso auth token

# Optional - for local testing
GITHUB_TOKEN=ghp_your_personal_access_token  # For reconcile testing
```

**Frontend** (`.env`):

```bash
VITE_BACKEND_URL=http://localhost:3001
```

## Project Structure

```
supercrew-kanban/
├── api/              # Vercel serverless entry point
│   └── cron/         # Scheduled jobs (validation, reconcile)
├── backend/          # Hono backend (Bun/Node)
│   ├── src/
│   │   ├── workers/  # Background workers (reconcile)
│   │   └── services/ # Core services (database, validation, branch-scanner)
│   └── test-*.ts     # Local testing scripts
├── frontend/         # React frontend (pnpm monorepo)
├── docs/             # Design docs and plans
│   ├── plans/        # Implementation plans
│   ├── testing-reconcile-locally.md
│   └── testing-reconcile-vercel.md
├── scripts/          # Build/dev scripts
└── vercel.json       # Vercel deployment config (cron schedules)
```

## Background Workers

### Daily Reconcile Worker

Runs daily at 3:00 AM UTC via Vercel cron:

- Scans all `user/*` branches in the GitHub repository
- Fetches `.supercrew/tasks/*/meta.yaml`, `dev-design.md`, `dev-plan.md`
- Syncs Git features to database (insert/update)
- Marks orphaned features (in DB but not in Git)

**Local testing:**

```bash
export GITHUB_TOKEN=ghp_your_personal_access_token
cd backend
bun run test-reconcile.ts
```

See [docs/testing-reconcile-locally.md](docs/testing-reconcile-locally.md) for details.

### Continuous Validation Worker

Runs every minute via Vercel cron:

- Checks features with `source=agent` (recently reported by agent)
- Validates against Git (content hash comparison)
- Updates `source` to `agent_verified`, `agent_stale`, or `agent_orphaned`

**Grace window:** 10 minutes for agent to push changes before marking orphaned.

## Troubleshooting

### Database Connection Issues

**Error:** `Failed to connect to Turso database`

**Solution:**
```bash
# Check if local database is running
lsof -i :8080

# Start local database
cd backend
turso dev --db-file kanban.db --port 8080

# Or check your Turso cloud credentials
echo $TURSO_DATABASE_URL
echo $TURSO_AUTH_TOKEN
```

### Reconcile Not Finding Features

**Symptom:** `scanned: 0` when running reconcile test

**Common causes:**
1. Missing or invalid `GITHUB_TOKEN` environment variable
2. Repository owner mismatch (check `REPO_OWNER` env var)
3. No `.supercrew/tasks/` directories on Git branches

**Solution:**
```bash
# Set GitHub token (create at https://github.com/settings/tokens)
export GITHUB_TOKEN=ghp_your_personal_access_token

# Verify correct repository
export REPO_OWNER=your-github-username
export REPO_NAME=supercrew-kanban

# Run test
cd backend
bun run test-reconcile.ts
```

### Agent-Reported Features Showing as Orphaned

**Symptom:** Features marked as `agent_orphaned` even though they exist

**Cause:** Agent reported feature but didn't push to Git within 10-minute grace window

**Solution:**
```bash
# Check if feature exists on Git
git log --all --oneline | grep "feature-name"

# If not pushed, push now
git push origin your-branch-name

# Wait 1 minute for validation cron to re-check
```

See [docs/troubleshooting-reconcile.md](docs/troubleshooting-reconcile.md) for detailed debugging guide.

## Related

- [supercrew](https://github.com/steins-z/supercrew) - Claude Code skills/plugins
