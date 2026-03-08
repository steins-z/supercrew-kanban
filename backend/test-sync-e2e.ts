#!/usr/bin/env bun

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'
const API_KEY = process.env.API_KEY ?? ''
const REPO_OWNER = process.env.REPO_OWNER ?? ''
const REPO_NAME = process.env.REPO_NAME ?? ''
const FEATURE_ID = process.env.FEATURE_ID ?? `sync-e2e-${Date.now()}`

if (!API_KEY || !REPO_OWNER || !REPO_NAME) {
  console.error('Missing required env vars: API_KEY, REPO_OWNER, REPO_NAME')
  process.exit(1)
}

function ensure(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { res, data }
}

async function main() {
  console.log(`Backend: ${BACKEND_URL}`)
  console.log(`Repo: ${REPO_OWNER}/${REPO_NAME}`)
  console.log(`Feature: ${FEATURE_ID}`)

  const metaYaml = `title: Sync E2E\nstatus: todo\n`
  const reportBody = {
    repo_owner: REPO_OWNER,
    repo_name: REPO_NAME,
    feature_id: FEATURE_ID,
    data: {
      status: 'todo',
      meta_yaml: metaYaml,
    },
  }

  console.log('Step 1: POST /api/features/report')
  const report = await jsonFetch(`${BACKEND_URL}/api/features/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(reportBody),
  })

  ensure(report.res.ok, `report failed: ${report.res.status} ${JSON.stringify(report.data)}`)
  ensure(report.data?.ok === true, 'report response ok=false')

  console.log('Step 2: GET /api/features/:id')
  const detail = await jsonFetch(
    `${BACKEND_URL}/api/features/${encodeURIComponent(FEATURE_ID)}?repo_owner=${encodeURIComponent(REPO_OWNER)}&repo_name=${encodeURIComponent(REPO_NAME)}`
  )

  ensure(detail.res.ok, `feature detail failed: ${detail.res.status} ${JSON.stringify(detail.data)}`)
  ensure(detail.data?.source === 'agent', 'feature source is not agent after report')
  ensure(detail.data?.sync_state === 'pending_verify', 'feature sync_state is not pending_verify')

  console.log('Step 3: GET /api/board')
  const board = await jsonFetch(
    `${BACKEND_URL}/api/board?repo_owner=${encodeURIComponent(REPO_OWNER)}&repo_name=${encodeURIComponent(REPO_NAME)}`
  )

  ensure(board.res.ok, `board failed: ${board.res.status} ${JSON.stringify(board.data)}`)

  const all = Object.values(board.data?.features ?? {}).flat()
  const matched = all.find((f: any) => f.id === FEATURE_ID)
  ensure(!!matched, 'feature not found in board response')
  ensure(matched.sync_state === 'pending_verify', 'board feature sync_state is not pending_verify')

  console.log('PASS: sync e2e (pending_verify)')
}

main().catch(err => {
  console.error('FAIL:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
