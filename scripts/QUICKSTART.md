# 🚀 Deployment Scripts

Complete deployment automation for SuperCrew Kanban.

## Quick Start

### Local Development (Daily Use)

```bash
# One command to start everything
./scripts/dev.sh
```

This starts:
- 🗄️ Turso database (port 8080)
- 🔧 Backend API (port 3001)
- 💻 Frontend UI (port 5173)

Press `Ctrl+C` to stop all services.

---

### Production Deployment (First Time)

```bash
# 1. Setup production database and get credentials
./scripts/deploy-setup.sh

# 2. Configure GitHub OAuth
./scripts/setup-oauth.sh

# 3. Add credentials to Vercel
vercel env add GITHUB_CLIENT_ID production
vercel env add GITHUB_CLIENT_SECRET production
vercel env add CRON_SECRET production
vercel env add GITHUB_TOKEN production

# 4. Deploy
git push origin main
```

---

## Scripts

| Script | Purpose |
|--------|---------|
| **dev.sh** | Start local development environment |
| **deploy-setup.sh** | Setup production Turso database |
| **setup-oauth.sh** | Configure GitHub OAuth App |

📖 **[Full Documentation](./README.md)**

---

## Environment Variables

### Local (auto-configured by scripts)

```bash
backend/.env
  TURSO_DATABASE_URL=http://127.0.0.1:8080
  TURSO_AUTH_TOKEN=dev-token
  GITHUB_CLIENT_ID=...
  GITHUB_CLIENT_SECRET=...
```

### Production (Vercel Dashboard)

```bash
TURSO_DATABASE_URL      # from deploy-setup.sh
TURSO_AUTH_TOKEN        # from deploy-setup.sh
GITHUB_CLIENT_ID        # from setup-oauth.sh
GITHUB_CLIENT_SECRET    # from setup-oauth.sh
CRON_SECRET            # generate: openssl rand -hex 32
GITHUB_TOKEN           # Personal Access Token
```

---

## Troubleshooting

**Port conflicts:**
```bash
# Scripts auto-cleanup, but if needed:
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
lsof -ti:8080 | xargs kill -9
```

**Database not initialized:**
```bash
cd backend && bun run init-db.ts
```

**Need to recreate database:**
```bash
turso db destroy your-db-name
./scripts/deploy-setup.sh
```

---

Made with ❤️ by Claude & Team
