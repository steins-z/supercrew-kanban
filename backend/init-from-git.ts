#!/usr/bin/env bun
// Initialize database with data from Git (one-time sync)

console.log('🔄 Initializing database from Git...\n')

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
const REPO_OWNER = process.env.REPO_OWNER || 'steins-z'
const REPO_NAME = process.env.REPO_NAME || 'supercrew-kanban'

// Check if user is authenticated
const { getAccessToken } = await import('../frontend/packages/app-core/src/auth.js')

let token = process.env.GITHUB_TOKEN

if (!token) {
  console.log('⚠️  GITHUB_TOKEN not set in environment')
  console.log('💡 Please provide your GitHub Personal Access Token:')
  console.log('   1. Go to https://github.com/settings/tokens')
  console.log('   2. Generate a token with "repo" scope')
  console.log('   3. Run: export GITHUB_TOKEN=ghp_your_token\n')
  console.log('🔄 Attempting to use stored OAuth token from localStorage...\n')

  // Try to get token from auth (if running in browser context)
  try {
    token = getAccessToken()
    if (token) {
      console.log('✅ Found OAuth token in auth storage\n')
    }
  } catch (e) {
    console.error('❌ Could not get OAuth token from auth storage')
    console.error('   Please set GITHUB_TOKEN environment variable\n')
    process.exit(1)
  }
}

if (!token) {
  console.error('❌ No GitHub token available')
  console.error('   Set GITHUB_TOKEN or authenticate in the web app first\n')
  process.exit(1)
}

console.log(`📦 Repository: ${REPO_OWNER}/${REPO_NAME}`)
console.log(`🌐 Backend URL: ${BACKEND_URL}\n`)

try {
  // Call multi-branch API to trigger Git scan + DB sync
  console.log('🔍 Scanning Git branches...')

  const response = await fetch(
    `${BACKEND_URL}/api/board/multi-branch?branch_pattern=user/*`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Repo-Owner': REPO_OWNER,
        'X-Repo-Name': REPO_NAME,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error (${response.status}): ${error}`)
  }

  const data = await response.json()

  console.log(`✅ Git scan completed!`)
  console.log(`   - Scanned branches: ${data.metadata?.totalBranches || 0}`)
  console.log(`   - Features found: ${data.features?.length || 0}\n`)

  // Wait a moment for background sync to complete
  console.log('⏳ Waiting for database sync to complete...')
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Verify database has data
  console.log('🔍 Verifying database...')

  const dbResponse = await fetch(
    `${BACKEND_URL}/api/board?repo_owner=${REPO_OWNER}&repo_name=${REPO_NAME}`
  )

  if (!dbResponse.ok) {
    throw new Error(`Database API error: ${dbResponse.status}`)
  }

  const dbData = await dbResponse.json()
  const totalFeatures = dbData.metadata?.total_features || 0

  console.log(`✅ Database verification complete!`)
  console.log(`   - Features in database: ${totalFeatures}\n`)

  if (totalFeatures > 0) {
    console.log('🎉 Success! Database initialized with Git data.')
    console.log('   You can now use database mode in the dashboard.\n')
  } else {
    console.log('⚠️  Warning: Database is still empty.')
    console.log('   Check backend logs for sync errors.\n')
  }

} catch (error) {
  console.error('❌ Initialization failed!')
  console.error(error)
  process.exit(1)
}
