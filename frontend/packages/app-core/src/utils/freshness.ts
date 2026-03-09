import type { SyncState, FreshnessIndicator } from '../types'

/**
 * Convert backend sync_state to UI freshness indicator
 */
export function getFreshnessIndicator(
  syncState?: SyncState,
  verified?: boolean
): FreshnessIndicator {
  if (!syncState) {
    return 'pending'
  }

  switch (syncState) {
    case 'synced':
      return verified ? 'verified' : 'pending'
    case 'local_only':
    case 'pending_push':
      return 'realtime'
    case 'pending_verify':
      return 'pending'
    case 'conflict':
      return 'conflict'
    case 'error':
      return 'stale'
    case 'git_missing':
      return 'orphaned'
    default:
      return 'pending'
  }
}

/**
 * Get icon for freshness indicator
 */
export function getFreshnessIcon(indicator: FreshnessIndicator): string {
  switch (indicator) {
    case 'verified':
      return '✅'
    case 'realtime':
      return '⚡'
    case 'pending':
      return '⏳'
    case 'conflict':
      return '⚠️'
    case 'stale':
      return '🕐'
    case 'orphaned':
      return '❌'
    default:
      return '⏳'
  }
}

/**
 * Get label for freshness indicator
 */
export function getFreshnessLabel(indicator: FreshnessIndicator): string {
  switch (indicator) {
    case 'verified':
      return 'Verified'
    case 'realtime':
      return 'Real-time'
    case 'pending':
      return 'Pending'
    case 'conflict':
      return 'Conflict'
    case 'stale':
      return 'Stale'
    case 'orphaned':
      return 'Deleted'
    default:
      return 'Unknown'
  }
}
