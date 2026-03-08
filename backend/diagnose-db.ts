#!/usr/bin/env bun
// Diagnose why database is empty

console.log('🔍 Database Empty Diagnostic\n')

const issues: string[] = []
const solutions: string[] = []

// Check 1: Database running
console.log('1️⃣ Checking if Turso database is running...')
try {
  const lsof = Bun.spawnSync(['lsof', '-i', ':8080'])
  const output = lsof.stdout.toString()
  if (output.includes('sqld')) {
    console.log('   ✅ Turso database is running on port 8080\n')
  } else {
    console.log('   ❌ Turso database is NOT running\n')
    issues.push('Turso database not running')
    solutions.push('Start database: cd backend && turso dev --db-file kanban.db --port 8080')
  }
} catch (e) {
  console.log('   ⚠️  Could not check if database is running\n')
}

// Check 2: GITHUB_TOKEN
console.log('2️⃣ Checking GITHUB_TOKEN...')
const githubToken = process.env.GITHUB_TOKEN
if (githubToken) {
  console.log(`   ✅ GITHUB_TOKEN is set (${githubToken.slice(0, 10)}...)\n`)
} else {
  console.log('   ❌ GITHUB_TOKEN is NOT set\n')
  issues.push('GITHUB_TOKEN not set')
  solutions.push('Set token: export GITHUB_TOKEN=ghp_your_personal_access_token')
  solutions.push('Get token at: https://github.com/settings/tokens')
}

// Check 3: Database schema
console.log('3️⃣ Checking database schema...')
try {
  const { createClient } = await import('@libsql/client')
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'http://127.0.0.1:8080',
    authToken: process.env.TURSO_AUTH_TOKEN || 'dev-token',
  })

  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
  if (tables.rows.some((r: any) => r.name === 'features')) {
    console.log('   ✅ Features table exists\n')

    // Check row count
    const count = await db.execute('SELECT COUNT(*) as count FROM features')
    const rowCount = (count.rows[0] as any).count
    console.log(`4️⃣ Checking data in database...`)
    console.log(`   📊 Features count: ${rowCount}\n`)

    if (rowCount === 0) {
      issues.push('Database is empty (0 features)')
      solutions.push('Run reconcile: REPO_OWNER=steins-z bun run test-reconcile.ts')
    }
  } else {
    console.log('   ❌ Features table does NOT exist\n')
    issues.push('Database schema not initialized')
    solutions.push('Initialize schema: bun run init-db.ts')
  }
} catch (e) {
  console.log(`   ❌ Could not connect to database: ${e}\n`)
  issues.push('Cannot connect to database')
}

// Check 4: Reconcile worker exists
console.log('5️⃣ Checking reconcile worker...')
try {
  await import('./src/workers/reconcile.js')
  console.log('   ✅ Reconcile worker code exists\n')
} catch (e) {
  console.log('   ❌ Reconcile worker NOT found\n')
  issues.push('Reconcile worker missing')
}

// Summary
console.log('━'.repeat(60))
console.log('\n📋 SUMMARY\n')

if (issues.length === 0) {
  console.log('✅ Everything looks good! Database should have data.\n')
  console.log('If still empty, check Vercel cron logs or run manual reconcile.\n')
} else {
  console.log(`❌ Found ${issues.length} issue(s):\n`)
  issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue}`)
  })
  console.log('\n💡 SOLUTIONS:\n')
  solutions.forEach((solution, i) => {
    console.log(`   ${i + 1}. ${solution}`)
  })
  console.log('')
}

console.log('━'.repeat(60))
