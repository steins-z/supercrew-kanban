#!/usr/bin/env bun
// Test Agent Reporting API

const BASE_URL = 'http://localhost:3001'
const REPO_OWNER = 'steins-z'
const REPO_NAME = 'supercrew-kanban'

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(emoji: string, message: string, color = colors.reset) {
  console.log(`${emoji} ${color}${message}${colors.reset}`)
}

function logSection(title: string) {
  console.log(`\n${colors.cyan}${'='.repeat(70)}`)
  console.log(`${title}`)
  console.log(`${'='.repeat(70)}${colors.reset}\n`)
}

async function testApiHealth() {
  logSection('Step 1: Test API Health')

  try {
    const response = await fetch(`${BASE_URL}/health`)
    const data = await response.json()

    if (response.ok) {
      log('✅', `API is healthy: ${JSON.stringify(data)}`, colors.green)
      return true
    } else {
      log('❌', `API health check failed: ${response.status}`, colors.red)
      return false
    }
  } catch (error) {
    log('❌', `Failed to connect to API: ${error}`, colors.red)
    return false
  }
}

async function createApiKey() {
  logSection('Step 2: Create API Key')

  try {
    const response = await fetch(`${BASE_URL}/api/admin/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repo_owner: REPO_OWNER,
        repo_name: REPO_NAME,
        created_by: 'test-script',
        expires_in_days: 30,
        description: 'Test API key for agent reporting',
      }),
    })

    const data = await response.json()

    if (response.ok && data.api_key) {
      log('✅', `API key created successfully`, colors.green)
      log('🔑', `API Key: ${data.api_key}`, colors.yellow)
      log('📝', `Key Hash: ${data.key_hash}`, colors.blue)
      log('⏰', `Expires: ${data.expires_at || 'Never'}`, colors.blue)
      return data.api_key
    } else {
      log('❌', `Failed to create API key: ${JSON.stringify(data)}`, colors.red)
      return null
    }
  } catch (error) {
    log('❌', `Error creating API key: ${error}`, colors.red)
    return null
  }
}

async function reportSingleFeature(apiKey: string) {
  logSection('Step 3: Report Single Feature (Agent Upload)')

  const testFeature = {
    repo_owner: REPO_OWNER,
    repo_name: REPO_NAME,
    feature_id: 'test-agent-reporting',
    branch: 'user/test-user/test-agent-reporting',
    data: {
      status: 'doing',
      owner: 'test-user',
      priority: 'P1',
      progress: 50,
      meta_yaml: `id: test-agent-reporting
title: "Test Agent Reporting Feature"
status: doing
owner: test-user
priority: P1
created: "2026-03-07"
updated: "2026-03-07"`,
      dev_design_md: `---
status: draft
reviewers: []
---

# Test Agent Reporting — Technical Design

## Design Decisions

Testing the agent reporting API to ensure local agents can upload status updates.

## Architecture

- Local agent reads .supercrew/tasks/ directory
- Sends status updates to central API
- API validates and stores in Turso database

## Implementation Notes

This is a test feature to validate the API works correctly.`,
      dev_plan_md: `---
total_tasks: 3
completed_tasks: 1
progress: 33
---

# Test Agent Reporting — Implementation Plan

## Tasks

- [x] Task 1: Create API endpoint
- [ ] Task 2: Implement authentication
- [ ] Task 3: Test end-to-end flow`,
      prd_md: `# Test Agent Reporting

## Background

We need to test that local agents can report kanban card status to the central database.

## Requirements

1. Agent authentication via API keys
2. Status update endpoint
3. Branch-level tracking`,
    },
  }

  try {
    const response = await fetch(`${BASE_URL}/api/features/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(testFeature),
    })

    const data = await response.json()

    if (response.ok) {
      log('✅', `Feature reported successfully`, colors.green)
      log('📊', `Feature ID: ${data.feature_id}`, colors.blue)
      log('🔍', `Source: ${data.source}`, colors.blue)
      log('✓', `Verified: ${data.verified}`, colors.blue)
      log('⏳', `Queued for validation: ${data.queued_for_validation}`, colors.blue)
      log('💬', `Message: ${data.message}`, colors.yellow)
      return true
    } else {
      log('❌', `Failed to report feature: ${JSON.stringify(data)}`, colors.red)
      return false
    }
  } catch (error) {
    log('❌', `Error reporting feature: ${error}`, colors.red)
    return false
  }
}

async function reportBatchFeatures(apiKey: string) {
  logSection('Step 4: Report Batch Features (Multiple Uploads)')

  const batchRequest = {
    repo_owner: REPO_OWNER,
    repo_name: REPO_NAME,
    features: [
      {
        feature_id: 'batch-test-1',
        branch: 'user/test-user/batch-test-1',
        data: {
          status: 'todo',
          owner: 'test-user',
          priority: 'P2',
          progress: 0,
          meta_yaml: `id: batch-test-1
title: "Batch Test Feature 1"
status: todo
owner: test-user
priority: P2
created: "2026-03-07"
updated: "2026-03-07"`,
        },
      },
      {
        feature_id: 'batch-test-2',
        branch: 'user/test-user/batch-test-2',
        data: {
          status: 'ready-to-ship',
          owner: 'test-user',
          priority: 'P0',
          progress: 100,
          meta_yaml: `id: batch-test-2
title: "Batch Test Feature 2"
status: ready-to-ship
owner: test-user
priority: P0
created: "2026-03-07"
updated: "2026-03-07"`,
        },
      },
    ],
  }

  try {
    const response = await fetch(`${BASE_URL}/api/features/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(batchRequest),
    })

    const data = await response.json()

    if (response.ok) {
      log('✅', `Batch upload successful`, colors.green)
      log('📊', `Queued for validation: ${data.queued_for_validation}`, colors.blue)
      log('📝', `Results:`, colors.yellow)
      for (const result of data.results) {
        if (result.status === 'updated') {
          log('  ✓', `${result.feature_id}: ${result.status}`, colors.green)
        } else {
          log('  ✗', `${result.feature_id}: ${result.status} - ${result.error}`, colors.red)
        }
      }
      return true
    } else {
      log('❌', `Failed to upload batch: ${JSON.stringify(data)}`, colors.red)
      return false
    }
  } catch (error) {
    log('❌', `Error uploading batch: ${error}`, colors.red)
    return false
  }
}

async function verifyBoardData() {
  logSection('Step 5: Verify Board Data')

  try {
    const response = await fetch(
      `${BASE_URL}/api/board?repo_owner=${REPO_OWNER}&repo_name=${REPO_NAME}`
    )

    const data = await response.json()

    if (response.ok) {
      log('✅', `Board data fetched successfully`, colors.green)
      log('📊', `Total features: ${data.metadata.total_features}`, colors.blue)
      log('📋', `Status breakdown:`, colors.yellow)
      log('  📝', `Todo: ${data.features.todo.length}`, colors.blue)
      log('  🏗️', `Doing: ${data.features.doing.length}`, colors.blue)
      log('  🚀', `Ready to Ship: ${data.features['ready-to-ship'].length}`, colors.blue)
      log('  ✅', `Shipped: ${data.features.shipped.length}`, colors.blue)

      // Check if our test features are there
      const allFeatures = [
        ...data.features.todo,
        ...data.features.doing,
        ...data.features['ready-to-ship'],
        ...data.features.shipped,
      ]

      const testFeatureIds = ['test-agent-reporting', 'batch-test-1', 'batch-test-2']
      log('\n🔍', `Checking for test features:`, colors.yellow)

      for (const featureId of testFeatureIds) {
        const found = allFeatures.find(f => f.id === featureId)
        if (found) {
          log('  ✓', `${featureId} - Status: ${found.status}, Progress: ${found.progress}%`, colors.green)
        } else {
          log('  ✗', `${featureId} - Not found`, colors.red)
        }
      }

      return true
    } else {
      log('❌', `Failed to fetch board data: ${JSON.stringify(data)}`, colors.red)
      return false
    }
  } catch (error) {
    log('❌', `Error fetching board data: ${error}`, colors.red)
    return false
  }
}

async function listApiKeys() {
  logSection('Step 6: List API Keys')

  try {
    const response = await fetch(
      `${BASE_URL}/api/admin/api-keys?repo_owner=${REPO_OWNER}&repo_name=${REPO_NAME}`
    )

    const data = await response.json()

    if (response.ok) {
      log('✅', `API keys fetched successfully`, colors.green)
      log('🔑', `Total keys: ${data.keys.length}`, colors.blue)

      for (const key of data.keys) {
        console.log(`\n  Key Hash: ${key.key_hash.substring(0, 16)}...`)
        console.log(`  Created: ${key.created_at}`)
        console.log(`  Created By: ${key.created_by || 'N/A'}`)
        console.log(`  Expires: ${key.expires_at || 'Never'}`)
        console.log(`  Revoked: ${key.revoked}`)
        console.log(`  Last Used: ${key.last_used_at || 'Never'}`)
        console.log(`  Description: ${key.description || 'N/A'}`)
      }

      return true
    } else {
      log('❌', `Failed to list API keys: ${JSON.stringify(data)}`, colors.red)
      return false
    }
  } catch (error) {
    log('❌', `Error listing API keys: ${error}`, colors.red)
    return false
  }
}

// Main test runner
async function runTests() {
  console.log(`\n${colors.cyan}╔${'═'.repeat(68)}╗`)
  console.log(`║${' '.repeat(15)}🧪 Agent Reporting API Test Suite${' '.repeat(19)}║`)
  console.log(`╚${'═'.repeat(68)}╝${colors.reset}\n`)

  const results = {
    health: false,
    apiKey: null as string | null,
    singleReport: false,
    batchReport: false,
    boardData: false,
    listKeys: false,
  }

  // Step 1: Health check
  results.health = await testApiHealth()
  if (!results.health) {
    log('💥', 'API is not healthy. Stopping tests.', colors.red)
    return
  }

  // Step 2: Create API key
  results.apiKey = await createApiKey()
  if (!results.apiKey) {
    log('💥', 'Failed to create API key. Stopping tests.', colors.red)
    return
  }

  // Step 3: Report single feature
  results.singleReport = await reportSingleFeature(results.apiKey)

  // Step 4: Report batch features
  results.batchReport = await reportBatchFeatures(results.apiKey)

  // Step 5: Verify board data
  results.boardData = await verifyBoardData()

  // Step 6: List API keys
  results.listKeys = await listApiKeys()

  // Summary
  logSection('Test Summary')

  const testResults = [
    { name: 'API Health Check', passed: results.health },
    { name: 'API Key Creation', passed: Boolean(results.apiKey) },
    { name: 'Single Feature Report', passed: results.singleReport },
    { name: 'Batch Feature Report', passed: results.batchReport },
    { name: 'Board Data Verification', passed: results.boardData },
    { name: 'API Keys List', passed: results.listKeys },
  ]

  const passedCount = testResults.filter(t => t.passed).length
  const totalCount = testResults.length

  for (const result of testResults) {
    if (result.passed) {
      log('✅', result.name, colors.green)
    } else {
      log('❌', result.name, colors.red)
    }
  }

  console.log(`\n${colors.cyan}${'─'.repeat(70)}${colors.reset}`)

  if (passedCount === totalCount) {
    log('🎉', `All tests passed! (${passedCount}/${totalCount})`, colors.green)
  } else {
    log('⚠️', `Some tests failed (${passedCount}/${totalCount})`, colors.yellow)
  }

  console.log(`${colors.cyan}${'─'.repeat(70)}${colors.reset}\n`)
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error)
  process.exit(1)
})
