import { GitHubClient } from './src/services/github.js'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!
const REPO_OWNER = 'steins-z'
const REPO_NAME = 'supercrew-kanban'
const BRANCH = 'user/qunmi/database-agent-reporting-api'

async function testGitHubAPI() {
  console.log('🧪 Testing GitHub API...')
  console.log(`📦 Repository: ${REPO_OWNER}/${REPO_NAME}`)
  console.log(`🌿 Branch: ${BRANCH}`)
  console.log('')

  const gh = new GitHubClient(GITHUB_TOKEN, REPO_OWNER, REPO_NAME)

  try {
    console.log('1. Listing feature directories...')
    const featureDirs = await gh.listFeatureDirs(BRANCH)
    console.log(`   Found ${featureDirs.length} feature directories:`)
    featureDirs.forEach(dir => console.log(`   - ${dir}`))
    console.log('')

    if (featureDirs.includes('test-reconcile-feature')) {
      console.log('2. Fetching test-reconcile-feature files...')
      const meta = await gh.getFileContent('test-reconcile-feature', 'meta.yaml', BRANCH)
      const design = await gh.getFileContent('test-reconcile-feature', 'dev-design.md', BRANCH)
      const plan = await gh.getFileContent('test-reconcile-feature', 'dev-plan.md', BRANCH)

      console.log(`   meta.yaml: ${meta ? meta.length + ' bytes' : 'NOT FOUND'}`)
      console.log(`   dev-design.md: ${design ? design.length + ' bytes' : 'NOT FOUND'}`)
      console.log(`   dev-plan.md: ${plan ? plan.length + ' bytes' : 'NOT FOUND'}`)
    }

    console.log('\n✅ GitHub API test completed!')
  } catch (error) {
    console.error('\n❌ GitHub API test failed!')
    console.error(error)
    process.exit(1)
  }
}

testGitHubAPI()
