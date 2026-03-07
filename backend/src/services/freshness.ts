// Freshness calculation service for board data
// Determines data quality indicators: verified, realtime, stale, orphaned

export type FreshnessIndicator = 'verified' | 'realtime' | 'stale' | 'orphaned'

export interface FreshnessMetrics {
  verified_count: number
  realtime_count: number
  stale_count: number
  orphaned_count: number
  total_count: number
  verified_percentage: number
  stale_percentage: number
  should_fallback_to_git: boolean
}

export interface FeatureWithFreshness {
  id: string
  source: string
  verified: boolean
  updated: string
  freshness?: FreshnessIndicator
}

// ============================================================================
// Freshness Calculation
// ============================================================================

/**
 * Calculate freshness indicator for a single feature
 */
export function calculateFeatureFreshness(feature: FeatureWithFreshness): FreshnessIndicator {
  // Case 1: Verified by Git validation
  if (feature.verified && feature.source === 'git') {
    return 'verified'
  }

  // Case 2: Orphaned (deleted from Git or marked as such)
  if (feature.source === 'agent_orphaned') {
    return 'orphaned'
  }

  // Case 3: Agent-reported, not yet verified
  if (feature.source === 'agent' || feature.source === 'agent_stale') {
    const ageMinutes = getAgeInMinutes(feature.updated)

    // Fresh agent data (< 5 minutes)
    if (ageMinutes < 5) {
      return 'realtime'
    }

    // Stale agent data (> 5 minutes, awaiting validation)
    return 'stale'
  }

  // Default: if Git source but not verified, consider stale
  if (feature.source === 'git' && !feature.verified) {
    return 'stale'
  }

  // Fallback (shouldn't happen)
  return 'verified'
}

/**
 * Calculate freshness metrics for all features
 */
export async function calculateFreshness(
  features: FeatureWithFreshness[]
): Promise<FreshnessMetrics> {
  let verified_count = 0
  let realtime_count = 0
  let stale_count = 0
  let orphaned_count = 0

  for (const feature of features) {
    const freshness = calculateFeatureFreshness(feature)

    switch (freshness) {
      case 'verified':
        verified_count++
        break
      case 'realtime':
        realtime_count++
        break
      case 'stale':
        stale_count++
        break
      case 'orphaned':
        orphaned_count++
        break
    }
  }

  const total_count = features.length
  const verified_percentage = total_count > 0 ? (verified_count / total_count) * 100 : 100
  const stale_percentage = total_count > 0 ? (stale_count / total_count) * 100 : 0

  // Fallback to Git if >50% of data is stale
  const should_fallback_to_git = stale_percentage > 50

  return {
    verified_count,
    realtime_count,
    stale_count,
    orphaned_count,
    total_count,
    verified_percentage: Math.round(verified_percentage),
    stale_percentage: Math.round(stale_percentage),
    should_fallback_to_git,
  }
}

/**
 * Add freshness indicators to features
 */
export function enrichFeaturesWithFreshness<T extends FeatureWithFreshness>(
  features: T[]
): (T & { freshness: FreshnessIndicator })[] {
  return features.map(feature => ({
    ...feature,
    freshness: calculateFeatureFreshness(feature),
  }))
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get age of timestamp in minutes
 */
function getAgeInMinutes(timestamp: string | number): number {
  const date = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp
  const now = Date.now()
  return (now - date) / 60000
}

/**
 * Check if feature should trigger Git fallback
 */
export function shouldRefreshFromGit(feature: FeatureWithFreshness): boolean {
  const freshness = calculateFeatureFreshness(feature)
  return freshness === 'stale' || freshness === 'orphaned'
}
