# Troubleshooting Guide - Git-DB Reconcile

This guide covers common issues with the Git-DB sync system and how to debug them.

## Table of Contents

- [Daily Reconcile Worker Issues](#daily-reconcile-worker-issues)
- [Continuous Validation Issues](#continuous-validation-issues)
- [Database Connection Problems](#database-connection-problems)
- [GitHub API Issues](#github-api-issues)
- [Source Field State Debugging](#source-field-state-debugging)

---

## Daily Reconcile Worker Issues

### Issue: Reconcile finds 0 features

**Symptoms:**
```
[Reconcile] Discovered 1 branches
[Reconcile] Fetched 0 feature snapshots
[Reconcile] Mapped 0 unique features
```

**Diagnosis:**

1. **Check if branches match the pattern:**

```bash
# Reconcile scans branches matching 'user/*' pattern
git branch -a | grep 'user/'

# Example valid branches:
# user/steins-z/backlog-feature-xyz
# user/steins-z/feature-xyz
```

2. **Check if .supercrew/tasks/ exists on branches:**

```bash
# List features on a specific branch
gh api "repos/OWNER/REPO/contents/.supercrew/tasks?ref=user/USERNAME/BRANCH" --jq '.[].name'

# Example:
gh api "repos/steins-z/supercrew-kanban/contents/.supercrew/tasks?ref=user/qunmi/database-agent-reporting-api" --jq '.[].name'
```

3. **Check GitHub token validity:**

```bash
# Test GitHub API access
export GITHUB_TOKEN=ghp_your_token
gh auth status

# Or test directly
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| `GITHUB_TOKEN` not set | `export GITHUB_TOKEN=ghp_your_token` |
| Wrong repository owner | Set `REPO_OWNER=your-username` |
| No `user/*` branches exist | Create branch: `git checkout -b user/username/feature` |
| `.supercrew/tasks/` not committed | `git add .supercrew/ && git commit && git push` |

---

### Issue: Features found but not inserted to DB

**Symptoms:**
```
[Reconcile] Mapped 5 unique features
[Reconcile] Synced: 0 inserted, 0 updated
```

**Diagnosis:**

1. **Check database connection:**

```bash
# Local dev - check if Turso is running
lsof -i :8080

# Production - check Vercel environment variables
vercel env ls
```

2. **Check database table exists:**

```bash
# Connect to local database
turso db shell --db-file backend/kanban.db

# Check table schema
.schema features

# Count existing features
SELECT COUNT(*) FROM features;
```

3. **Check for errors in reconcile logs:**

```bash
# Production - check Vercel function logs
vercel logs --function api/cron/reconcile
```

**Solution:**

- If table doesn't exist, run migrations (create `backend/migrations/` if needed)
- Check `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are correctly set
- Verify database permissions (Turso auth token must have write access)

---

## Continuous Validation Issues

### Issue: Agent-verified features reverting to 'agent'

**Symptoms:**

Features that were marked `agent_verified` keep appearing as `agent` in the database.

**Diagnosis:**

1. **Check if Git content actually matches:**

```bash
# Get Git content hash
cd .supercrew/tasks/feature-id
cat meta.yaml dev-design.md dev-plan.md | md5sum

# Compare with database record
# (Use database client or API to fetch content hash)
```

2. **Check validation cron logs:**

```bash
# Production
vercel logs --function api/cron/validate

# Look for comparison results
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Agent changed files after push | Normal behavior - validation will detect mismatch |
| Git content outdated (old branch) | Fetch latest: `git fetch origin && git merge origin/main` |
| Content hash calculation mismatch | Check if files have trailing whitespace differences |

---

### Issue: Features stuck as 'agent_orphaned'

**Symptoms:**

Features show `source=agent_orphaned` even though they exist on Git.

**Diagnosis:**

1. **Check if feature exists on any branch:**

```bash
# Search all branches for feature directory
git log --all --full-history --source --oneline -- .supercrew/tasks/feature-id

# Or use GitHub API
gh api "repos/OWNER/REPO/contents/.supercrew/tasks/feature-id?ref=BRANCH"
```

2. **Check when feature was last agent-reported:**

```bash
# Look at database timestamps
# last_agent_reported_at vs last_git_checked_at
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Agent never pushed to Git | Push branch: `git push origin user/username/feature` |
| Feature on backlog branch but worker scans `user/*` | Move to work branch: `git checkout -b user/username/feature` |
| 10-minute grace window expired | Normal - reconcile will fix at 3am UTC |

**Manual Fix:**

If feature exists on Git but marked as orphaned:

```bash
# Trigger manual reconcile (local test)
cd backend
export GITHUB_TOKEN=ghp_your_token
bun run test-reconcile.ts

# Or wait for next daily reconcile (3am UTC)
```

---

## Database Connection Problems

### Issue: "Connection refused" on port 8080

**Symptoms:**
```
Error: Failed to connect to http://127.0.0.1:8080
```

**Solution:**

```bash
# Start local Turso database
cd backend
turso dev --db-file kanban.db --port 8080

# In another terminal, verify it's running
curl http://127.0.0.1:8080/health
```

### Issue: Production database not found

**Symptoms:**
```
Turso error: Database 'kanban-db' not found
```

**Solution:**

1. **Check if database exists:**

```bash
turso db list
```

2. **Create database if missing:**

```bash
turso db create kanban-db
```

3. **Get credentials and set in Vercel:**

```bash
turso db show kanban-db

# Set environment variables
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
```

---

## GitHub API Issues

### Issue: Rate limit exceeded

**Symptoms:**
```
Error: GitHub API rate limit exceeded
```

**Diagnosis:**

```bash
# Check rate limit status
gh api rate_limit

# Or using curl
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/rate_limit
```

**Solution:**

- Wait for rate limit reset (shown in response headers)
- Use authenticated requests (personal access token has higher limits)
- Reduce reconcile frequency (currently daily at 3am)

**Rate Limits:**

| Type | Limit |
|------|-------|
| Unauthenticated | 60 requests/hour |
| Authenticated | 5,000 requests/hour |
| GraphQL | 5,000 points/hour |

### Issue: 401 Unauthorized

**Symptoms:**
```
Error: Failed to list features on branch: 401
```

**Common Causes:**

1. **Token not set:**
```bash
export GITHUB_TOKEN=ghp_your_token
```

2. **Token expired:**
```bash
# Check token validity
gh auth status

# Or regenerate at https://github.com/settings/tokens
```

3. **Token missing `repo` scope:**

Required scopes:
- `repo` (full control of private repositories)
- `read:org` (if accessing organization repos)

### Issue: 404 Not Found

**Symptoms:**
```
Error: Failed to list features on branch: 404
```

**Diagnosis:**

1. **Check if repository/branch exists:**

```bash
# List branches
gh api repos/OWNER/REPO/branches --jq '.[].name' | grep user/

# Check specific branch
gh api repos/OWNER/REPO/git/ref/heads/user/username/branch
```

2. **Check repository ownership:**

```bash
# Get repository details
gh repo view OWNER/REPO

# Verify you have access
gh repo view OWNER/REPO --json permissions
```

**Solution:**

- Verify `REPO_OWNER` and `REPO_NAME` are correct
- Check if branch was deleted or renamed
- Ensure token has access to repository (for private repos)

---

## Source Field State Debugging

### Understanding Source States

```
git               → Synced from Git (verified truth)
agent             → Reported by agent (pending verification)
agent_verified    → Agent data verified against Git
agent_stale       → Agent data older than Git
agent_orphaned    → Agent push never happened (>10min grace)
```

### State Transitions

```
agent → validation → git content matches?
                     ├─ YES → agent_verified
                     ├─ NO (Git newer) → agent_stale
                     └─ NO (Git missing + >10min) → agent_orphaned

git → always stays git (source of truth)

agent_verified → stays verified until next agent report
agent_stale → stays stale until reconcile fixes
agent_orphaned → stays orphaned until reconcile fixes
```

### How to Check Feature State

**Via API:**

```bash
# Get feature details
curl http://localhost:3001/api/features/feature-id | jq '.source, .verified, .sync_state'
```

**Via Database:**

```bash
# Connect to database
turso db shell --db-file backend/kanban.db

# Query feature
SELECT id, source, verified, sync_state, last_git_checked_at
FROM features
WHERE id = 'feature-id';
```

### Expected State After Actions

| Action | Expected Source | Expected sync_state |
|--------|----------------|---------------------|
| Daily reconcile (feature on Git) | `git` | `synced` |
| Agent POST (not yet on Git) | `agent` | `pending_verify` |
| Validation (agent matches Git) | `agent_verified` | `synced` |
| Validation (Git newer) | `agent_stale` | `conflict` |
| Validation (Git missing >10min) | `agent_orphaned` | `git_missing` |

---

## Debugging Workflow

### 1. Local Testing Checklist

```bash
# ✅ Set up environment
export GITHUB_TOKEN=ghp_your_token
export REPO_OWNER=your-username
export REPO_NAME=supercrew-kanban

# ✅ Start local database
cd backend
turso dev --db-file kanban.db --port 8080

# ✅ Run reconcile test
bun run test-reconcile.ts

# ✅ Expected output
# Scanned: 5+ (number of features)
# Inserted: 5+ (first run)
# Updated: 0 (first run)
# Orphaned: 0
# Errors: 0

# ✅ Verify in database
turso db shell --db-file kanban.db
SELECT id, title, source, verified FROM features;
.quit
```

### 2. Production Debugging

```bash
# ✅ Check cron job logs
vercel logs --function api/cron/reconcile --since 24h

# ✅ Check validation logs
vercel logs --function api/cron/validate --since 1h

# ✅ Manually trigger reconcile
curl -X GET https://your-app.vercel.app/api/cron/reconcile \
  -H "x-vercel-cron-secret: $CRON_SECRET"

# ✅ Check database state
turso db shell kanban-db
SELECT COUNT(*), source FROM features GROUP BY source;
.quit
```

### 3. When All Else Fails

**Nuclear option - re-sync from Git:**

```bash
# ⚠️ WARNING: This deletes all database features and re-imports from Git

# 1. Backup database first
turso db backup kanban-db

# 2. Clear features table
turso db shell kanban-db
DELETE FROM features;
.quit

# 3. Run reconcile
curl -X GET https://your-app.vercel.app/api/cron/reconcile \
  -H "x-vercel-cron-secret: $CRON_SECRET"

# 4. Verify
turso db shell kanban-db
SELECT COUNT(*) FROM features;
.quit
```

---

## Getting Help

If you encounter issues not covered here:

1. Check implementation plan: `docs/plans/2026-03-08-git-db-sync-implementation-plan.md`
2. Check design doc: `docs/plans/2026-03-08-git-db-sync-implementation.md`
3. Check Vercel function logs: `vercel logs --function api/cron/reconcile`
4. Check database schema: `turso db shell --db-file backend/kanban.db` → `.schema features`
5. Open an issue on GitHub with logs and error messages
