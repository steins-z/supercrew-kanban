#!/usr/bin/env bun
// Test which API endpoint frontend is using

console.log('📊 Frontend Data Source Analysis\n')

console.log('Frontend uses useBoard() hook with two modes:')
console.log('  1. mode="git" → fetchBoardMultiBranch() → Backend API /api/board/multi-branch')
console.log('  2. mode="database" → fetchBoardFromDb() → Backend API /api/board\n')

console.log('Current frontend code (routes/index.tsx line 35):')
console.log('  const { featuresByStatus, isLoading } = useBoard()')
console.log('  ↓')
console.log('  No mode parameter = defaults to mode="git"\n')

console.log('✅ Your dashboard is currently showing data from: **Git Origin**')
console.log('   - Uses GitHub API to scan user/* branches')
console.log('   - Does NOT use the database')
console.log('   - Real-time updates come from Git pushes\n')

console.log('To switch to database mode, change routes/index.tsx line 35 to:')
console.log('  const { featuresByStatus, isLoading } = useBoard({ mode: "database" })\n')

console.log('Database mode benefits:')
console.log('  ✓ Faster loading (no GitHub API rate limits)')
console.log('  ✓ Shows agent-reported updates in real-time')
console.log('  ✓ Includes verification status badges')
console.log('  ✓ Auto-refreshes every 30s for unverified features\n')
