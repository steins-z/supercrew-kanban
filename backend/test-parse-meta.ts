#!/usr/bin/env bun
// Test parseMetaYaml parsing

function parseMetaYaml(content: string): {
  title?: string
  status?: string
  owner?: string
  priority?: string
  progress?: number
} {
  const result: any = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim()
    let value: any = trimmed.slice(colonIdx + 1).trim()

    // Remove quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    // Parse numbers
    if (!isNaN(Number(value)) && value !== '') {
      value = Number(value)
    }

    result[key] = value
  }

  return result
}

function normalizeStatus(status: any): string {
  const normalized = String(status || 'todo').toLowerCase().trim()
  if (['todo', 'doing', 'ready-to-ship', 'shipped'].includes(normalized)) {
    return normalized
  }
  return 'todo'
}

// Test with actual meta.yaml content
const testCases = [
  { file: 'database-agent-reporting-api', status: 'doing' },
  { file: 'simplified-status-schema', status: 'ready-to-ship' },
  { file: 'supercrew-kanban-migration', status: 'shipped' },
]

for (const tc of testCases) {
  const path = `../.supercrew/tasks/${tc.file}/meta.yaml`
  try {
    const content = await Bun.file(path).text()
    const parsed = parseMetaYaml(content)
    const normalized = normalizeStatus(parsed.status)

    console.log(`\n${tc.file}:`)
    console.log(`  Parsed status: "${parsed.status}"`)
    console.log(`  Normalized: "${normalized}"`)
    console.log(`  Expected: "${tc.status}"`)
    console.log(`  ✅ Match: ${normalized === tc.status}`)
  } catch (e) {
    console.error(`Error reading ${tc.file}:`, e)
  }
}
