#!/usr/bin/env bun
// Check features table schema to verify git_commit_sha column

import { createClient, type Row } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'http://127.0.0.1:8080',
  authToken: process.env.TURSO_AUTH_TOKEN || 'dev-token',
})

interface PragmaTableInfoRow {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: unknown
  pk: number
}

try {
  console.log('📋 Checking features table schema...\n')

  // Get table info
  const result = await db.execute('PRAGMA table_info(features)')

  console.log('Columns:')
  console.table(result.rows)

  // Check for git_commit_sha
  const hasGitCommitSha = result.rows.some((row: Row) => {
    const tableInfo = row as unknown as PragmaTableInfoRow
    return tableInfo.name === 'git_commit_sha'
  })
  console.log(`\n${hasGitCommitSha ? '✅' : '❌'} git_commit_sha column exists: ${hasGitCommitSha}`)

  // Get current schema version
  console.log('\n📋 Schema versions:')
  const versions = await db.execute('SELECT * FROM schema_version ORDER BY version')
  console.table(versions.rows)

} catch (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}
