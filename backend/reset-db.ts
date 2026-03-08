#!/usr/bin/env bun
// Reset database - drop all tables and recreate

import { createClient } from '@libsql/client'

const db = createClient({
  url: 'http://127.0.0.1:8080',
  authToken: 'dev-token',
})

try {
  console.log('🗑️  Dropping existing tables...')

  // Drop tables in correct order (respecting foreign keys)
  await db.execute('DROP TABLE IF EXISTS validation_queue')
  await db.execute('DROP TABLE IF EXISTS branches')
  await db.execute('DROP TABLE IF EXISTS api_keys')
  await db.execute('DROP TABLE IF EXISTS features')

  console.log('✅ Tables dropped')

  console.log('\n📝 Recreating tables...')

  // Now run init-db to recreate
  const { execSync } = await import('child_process')
  execSync('bun run init-db.ts', { stdio: 'inherit' })

} catch (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}
