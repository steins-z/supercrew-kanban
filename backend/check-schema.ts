#!/usr/bin/env bun
// Check database schema

import { createClient } from '@libsql/client'

const db = createClient({
  url: 'http://127.0.0.1:8080',
  authToken: 'dev-token',
})

try {
  // Get branches table schema
  const result = await db.execute(
    "PRAGMA table_info(branches)"
  )

  console.log('Branches table columns:')
  console.table(result.rows)

} catch (error) {
  console.error('Error:', error)
}
