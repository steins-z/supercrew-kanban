import type { FreshnessIndicator } from '@vibe/app-core/types'

export interface VerificationBadgeProps {
  freshness: FreshnessIndicator
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
  stale: {
    emoji: '⏳',
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
  freshness,
  size = 'md',
  showTooltip = true,
}: VerificationBadgeProps) {
  const config = FRESHNESS_CONFIG[freshness]

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

export function VerificationBadgeCompact({ freshness }: { freshness: FreshnessIndicator }) {
  const config = FRESHNESS_CONFIG[freshness]

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
