import { dailyReconcile } from './src/workers/reconcile.js'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!
const REPO_OWNER = process.env.REPO_OWNER || 'qunmi'
const REPO_NAME = process.env.REPO_NAME || 'supercrew-kanban'

async function testReconcile() {
  console.log('🧪 Starting reconcile test...')
  console.log(`📦 Repository: ${REPO_OWNER}/${REPO_NAME}`)
  console.log('')

  try {
    const stats = await dailyReconcile(REPO_OWNER, REPO_NAME, GITHUB_TOKEN)

    console.log('\n✅ Reconcile completed successfully!')
    console.log('📊 Stats:')
    console.log(`  - Scanned: ${stats.scanned}`)
    console.log(`  - Inserted: ${stats.inserted}`)
    console.log(`  - Updated: ${stats.updated}`)
    console.log(`  - Orphaned: ${stats.orphaned}`)
    console.log(`  - Errors: ${stats.errors}`)
  } catch (error) {
    console.error('\n❌ Reconcile failed!')
    console.error(error)
    process.exit(1)
  }
}

testReconcile()
