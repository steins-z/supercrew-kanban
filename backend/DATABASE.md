# Local Development with Turso

## Quick Start

### 1. Start local Turso database

```bash
turso dev --db-file ./backend/dev.db
```

This starts a local SQLite database at `http://127.0.0.1:8080` with auth token `dev-token`.

### 2. Apply schema (first time only)

```bash
turso db shell --db-file ./backend/dev.db < backend/schema.sql
```

### 3. Start backend

```bash
cd backend
bun run dev
```

Backend will connect to local Turso at `http://127.0.0.1:8080`.

### 4. Start frontend

```bash
cd frontend/packages/local-web
pnpm dev
```

---

## Production Database

### Get production credentials

```bash
# Get database URL
turso db show supercrew-kanban --url

# Create auth token
turso db tokens create supercrew-kanban
```

### Update environment variables

Update `.env` and `backend/.env`:

```bash
TURSO_DATABASE_URL=libsql://supercrew-kanban-houlianpi.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

---

## Database Management

### View tables

```bash
turso db shell supercrew-kanban "SELECT name FROM sqlite_master WHERE type='table';"
```

### Check schema version

```bash
turso db shell supercrew-kanban "SELECT * FROM schema_version;"
```

### Query features

```bash
turso db shell supercrew-kanban "SELECT id, title, status FROM features;"
```

### View validation queue

```bash
turso db shell supercrew-kanban "SELECT * FROM validation_queue;"
```

---

## Troubleshooting

### Database connection error

If you see `Missing required environment variables: TURSO_DATABASE_URL`:

1. Check that `backend/.env` exists and has correct values
2. Restart the backend server
3. Verify local Turso is running: `curl http://127.0.0.1:8080` should respond

### Schema not applied

```bash
# Re-apply schema
turso db shell --db-file ./backend/dev.db < backend/schema.sql
```

### Reset local database

```bash
# Delete local database
rm backend/dev.db

# Re-apply schema
turso dev --db-file ./backend/dev.db &
turso db shell --db-file ./backend/dev.db < backend/schema.sql
```
