#!/usr/bin/env bun
// Run database migrations
// Usage: bun run run-migration.ts <migration-file.sql>

import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'http://127.0.0.1:8080',
  authToken: process.env.TURSO_AUTH_TOKEN || 'dev-token',
})

const migrationFile = process.argv[2]
if (!migrationFile) {
  console.error('Usage: bun run run-migration.ts <migration-file.sql>')
  process.exit(1)
}

try {
  const migrationPath = resolve(migrationFile)
  console.log(`Reading migration: ${migrationPath}`)

  const sql = readFileSync(migrationPath, 'utf-8')

  // Split into statements (handle comments)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements`)

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    console.log(`\nExecuting statement ${i + 1}/${statements.length}...`)
    console.log(stmt.substring(0, 80) + (stmt.length > 80 ? '...' : ''))

    await db.execute(stmt)
  }

  console.log('\n✅ Migration completed successfully!')

  // Check schema version
  const result = await db.execute('SELECT * FROM schema_version ORDER BY version DESC LIMIT 1')
  if (result.rows.length > 0) {
    console.log('\n📋 Current schema version:', result.rows[0])
  }

} catch (error) {
  console.error('❌ Migration failed:', error)
  process.exit(1)
}
