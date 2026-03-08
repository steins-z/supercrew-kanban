# Database Migrations

This directory contains SQL migration files for the SuperCrew Kanban database.

## Migration Files

- `2026-03-07-git-db-sync.sql` - Initial sync state fields
- `2026-03-08-git-commit-tracking.sql` - Git commit tracking (adds git_commit_sha column)

## Running Migrations

To apply a migration to your local database:

```bash
cd backend
bun run run-migration.ts migrations/2026-03-08-git-commit-tracking.sql
```

## Checking Schema

To verify the current database schema:

```bash
cd backend
bun run check-migration.ts
```

## Migration Strategy

This project uses Turso (libSQL) which is SQLite-compatible. Migrations follow these patterns:

1. **Adding columns**: Use `ALTER TABLE ADD COLUMN`
2. **Modifying constraints**: Use table recreation pattern (create new table, copy data, drop old, rename)
3. **Schema versioning**: Track applied migrations in `schema_version` table

## Important Notes

- Migrations are applied manually (not automatically on startup)
- For production (Turso cloud), migrations are applied via Turso CLI
- For local dev, migrations are applied via the run-migration.ts script
- Always test migrations on local database first
