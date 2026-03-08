# Deployment Guide

This directory contains deployment and setup scripts for SuperCrew Kanban.

## Scripts Overview

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `dev.sh` | Local development | Every day during development |
| `deploy-setup.sh` | Production deployment setup | Once, before first deploy |
| `setup-oauth.sh` | Configure GitHub OAuth | Once per environment (local + prod) |

## Quick Start

### First Time Setup (Local Development)

```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Set up GitHub OAuth for local development
./scripts/setup-oauth.sh
# Choose option 1) Local development

# 3. Start development environment
./scripts/dev.sh
```

This will:
- ✅ Start Turso database (port 8080)
- ✅ Initialize database schema
- ✅ Start backend (port 3001)
- ✅ Start frontend (port 5173)

### Production Deployment

```bash
# 1. Run deployment setup
./scripts/deploy-setup.sh

# 2. Set up GitHub OAuth for production
./scripts/setup-oauth.sh
# Choose option 2) Production

# 3. Review and update .env.production
nano .env.production

# 4. Add environment variables to Vercel
vercel env add GITHUB_CLIENT_ID production
vercel env add GITHUB_CLIENT_SECRET production
vercel env add CRON_SECRET production
vercel env add GITHUB_TOKEN production

# 5. Deploy
git push origin main
# or
vercel --prod
```

## Detailed Script Documentation

### `dev.sh` - Local Development

**What it does:**
1. Kills any existing processes on ports 8080, 3001, 5173
2. Starts Turso dev database server
3. Initializes database schema (creates tables)
4. Starts backend and frontend with `pnpm dev`

**Usage:**
```bash
./scripts/dev.sh
```

**Cleanup:**
Press `Ctrl+C` to stop all services. The script automatically cleans up processes.

**Logs:**
- Turso logs: `/tmp/turso-dev.log`
- Backend/Frontend: displayed in terminal

---

### `deploy-setup.sh` - Production Deployment Setup

**What it does:**
1. ✅ Checks prerequisites (Turso CLI, Vercel CLI)
2. 🔐 Authenticates with Turso
3. 🗄️ Creates production database
4. 📝 Applies database schema
5. 🔑 Generates connection credentials
6. ⚙️ Configures Vercel environment variables (optional)
7. 📄 Creates `.env.production` template

**Prerequisites:**
```bash
# Install Turso CLI
brew install turso

# Install Vercel CLI (optional)
npm install -g vercel
```

**Usage:**
```bash
./scripts/deploy-setup.sh
```

**Interactive prompts:**
- Database name (default: `supercrew-kanban`)
- Database location (default: `iad` - US East)
- Whether to configure Vercel now

**Output:**
- Database URL and auth token (displayed in terminal)
- `.env.production` file with template

**Available database locations:**
- `iad` - US East (Virginia) ⭐ Recommended for US
- `ord` - US Central (Chicago)
- `lax` - US West (Los Angeles)
- `ams` - Europe (Amsterdam) ⭐ Recommended for EU
- `gru` - South America (São Paulo)
- `nrt` - Asia (Tokyo) ⭐ Recommended for Asia
- `syd` - Australia (Sydney)

---

### `setup-oauth.sh` - GitHub OAuth Configuration

**What it does:**
1. Guides you through creating GitHub OAuth App
2. Collects Client ID and Client Secret
3. Updates appropriate `.env` file
4. Provides next steps

**Usage:**
```bash
./scripts/setup-oauth.sh
```

**For local development:**
- Creates OAuth App with callback: `http://localhost:3001/auth/callback`
- Updates `backend/.env`

**For production:**
- Creates OAuth App with callback: `https://your-domain.vercel.app/auth/callback`
- Updates `.env.production`
- Provides Vercel configuration commands

**GitHub OAuth App Settings:**
```
Application name: SuperCrew Kanban
Homepage URL:     http://localhost:5173 (local) or https://your-domain.vercel.app (prod)
Callback URL:     http://localhost:3001/auth/callback (local) or https://your-domain.vercel.app/auth/callback (prod)
```

---

## Environment Variables Reference

### Local Development (`backend/.env`)

```bash
# GitHub OAuth (local)
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=f0b3a5...

# Turso Database (local)
TURSO_DATABASE_URL=http://127.0.0.1:8080
TURSO_AUTH_TOKEN=dev-token

# Optional (defaults shown)
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
PORT=3001
```

### Production (`.env.production` + Vercel)

```bash
# Turso Database (production)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=eyJhbGc...

# GitHub OAuth (production)
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=f0b3a5...

# URLs (production)
FRONTEND_URL=https://your-domain.vercel.app
BACKEND_URL=https://your-domain.vercel.app

# Cron Job Security
CRON_SECRET=random_secret_string_here

# GitHub Token for validation worker
GITHUB_TOKEN=ghp_your_personal_access_token

# Optional
VALIDATION_BATCH_SIZE=10
PORT=3001
```

---

## Troubleshooting

### Port already in use

```bash
# Kill processes manually
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
lsof -ti:8080 | xargs kill -9
```

### Database schema not applied

```bash
# Re-initialize database
cd backend
bun run init-db.ts
```

### Turso authentication failed

```bash
# Re-login to Turso
turso auth login
```

### Vercel environment variables not set

```bash
# Add manually
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add GITHUB_CLIENT_ID production
vercel env add GITHUB_CLIENT_SECRET production
vercel env add CRON_SECRET production
vercel env add GITHUB_TOKEN production
```

---

## Common Workflows

### Daily Development

```bash
# Just run this every time
./scripts/dev.sh
```

### Update Database Schema

```bash
# 1. Edit backend/schema.sql

# 2. For local:
cd backend && bun run init-db.ts

# 3. For production:
turso db shell your-db-name < backend/schema.sql
```

### Create New GitHub OAuth App

```bash
./scripts/setup-oauth.sh
```

### Deploy to Production

```bash
git add .
git commit -m "feat: your changes"
git push origin main

# Vercel auto-deploys on push
```

### Manual Vercel Deploy

```bash
vercel --prod
```

---

## Security Notes

⚠️ **Never commit these files:**
- `backend/.env`
- `.env.production`
- `backend/init-db.ts` output

✅ **Safe to commit:**
- `backend/.env.example`
- `.env.example`
- All scripts in `scripts/`

---

## Support

- **Turso Issues**: https://github.com/tursodatabase/turso-cli/issues
- **Vercel Issues**: https://vercel.com/support
- **Project Issues**: https://github.com/steins-z/supercrew-kanban/issues
