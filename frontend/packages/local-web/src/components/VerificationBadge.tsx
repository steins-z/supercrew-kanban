import type { FreshnessIndicator, SyncState } from '@vibe/app-core/types'
import { getFreshnessIndicator, getFreshnessIcon, getFreshnessLabel } from '@vibe/app-core/utils/freshness'

export interface VerificationBadgeProps {
  // New API: pass sync_state and verified
  syncState?: SyncState
  verified?: boolean
  // Legacy API: pass freshness directly
  freshness?: FreshnessIndicator
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
}

const FRESHNESS_CONFIG: Record<FreshnessIndicator, {
  emoji: string
  label: string
  description: string
  className: string
}> = {
  verified: {
    emoji: '✅',
    label: 'Verified',
    description: 'Validated against Git source of truth',
    className: 'verification-badge--verified',
  },
  realtime: {
    emoji: '⚡',
    label: 'Real-time',
    description: 'Agent-reported update (awaiting Git verification)',
    className: 'verification-badge--realtime',
  },
  pending: {
    emoji: '⏳',
    label: 'Pending',
    description: 'Awaiting validation',
    className: 'verification-badge--pending',
  },
  conflict: {
    emoji: '⚠️',
    label: 'Conflict',
    description: 'SHA mismatch, using newer Agent data',
    className: 'verification-badge--conflict',
  },
  stale: {
    emoji: '🕐',
    label: 'Stale',
    description: 'Data may be outdated, validation pending',
    className: 'verification-badge--stale',
  },
  orphaned: {
    emoji: '❌',
    label: 'Orphaned',
    description: 'Feature deleted from Git repository',
    className: 'verification-badge--orphaned',
  },
}

export function VerificationBadge({
  syncState,
  verified,
  freshness,
  size = 'md',
  showTooltip = true,
}: VerificationBadgeProps) {
  // Determine freshness indicator
  const indicator = freshness ?? getFreshnessIndicator(syncState, verified)
  const config = FRESHNESS_CONFIG[indicator]

  const sizeClass = {
    sm: 'verification-badge--sm',
    md: 'verification-badge--md',
    lg: 'verification-badge--lg',
  }[size]

  return (
    <span
      className={`verification-badge ${config.className} ${sizeClass}`}
      title={showTooltip ? `${config.label}: ${config.description}` : undefined}
      role="status"
      aria-label={`${config.label}: ${config.description}`}
    >
      <span className="verification-badge__emoji" aria-hidden="true">
        {config.emoji}
      </span>
      <span className="verification-badge__label">
        {config.label}
      </span>
    </span>
  )
}

export function VerificationBadgeCompact({
  syncState,
  verified,
  freshness,
}: {
  syncState?: SyncState
  verified?: boolean
  freshness?: FreshnessIndicator
}) {
  // Determine freshness indicator
  const indicator = freshness ?? getFreshnessIndicator(syncState, verified)
  const config = FRESHNESS_CONFIG[indicator]

  return (
    <span
      className={`verification-badge-compact ${config.className}`}
      title={`${config.label}: ${config.description}`}
      role="status"
      aria-label={config.label}
    >
      {config.emoji}
    </span>
  )
}

