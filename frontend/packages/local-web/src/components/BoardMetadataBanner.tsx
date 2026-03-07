import type { BoardMetadata } from '@vibe/app-core/types'
import { VerificationBadgeCompact } from './VerificationBadge'

export interface BoardMetadataBannerProps {
  metadata: BoardMetadata
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function BoardMetadataBanner({
  metadata,
  onRefresh,
  isRefreshing = false,
}: BoardMetadataBannerProps) {
  const { source, freshness, total_features, last_updated } = metadata

  // Calculate unverified count
  const unverifiedCount = freshness
    ? freshness.realtime_count + freshness.stale_count + freshness.orphaned_count
    : 0

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)

    if (diffSec < 60) return `${diffSec}s ago`
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="board-metadata-banner">
      <div className="board-metadata-banner__content">
        {/* Data Source */}
        <div className="board-metadata-banner__item">
          <span className="board-metadata-banner__label">Source:</span>
          <span className="board-metadata-banner__value board-metadata-banner__source">
            {source === 'database' ? '💾 Database' : '📁 Git'}
          </span>
        </div>

        {/* Total Features */}
        <div className="board-metadata-banner__item">
          <span className="board-metadata-banner__label">Features:</span>
          <span className="board-metadata-banner__value">{total_features}</span>
        </div>

        {/* Freshness Stats (DB mode only) */}
        {freshness && (
          <>
            <div className="board-metadata-banner__item">
              <span className="board-metadata-banner__label">Verified:</span>
              <span className="board-metadata-banner__value">
                <VerificationBadgeCompact freshness="verified" />
                {freshness.verified_count}
              </span>
            </div>

            {freshness.realtime_count > 0 && (
              <div className="board-metadata-banner__item">
                <span className="board-metadata-banner__label">Real-time:</span>
                <span className="board-metadata-banner__value">
                  <VerificationBadgeCompact freshness="realtime" />
                  {freshness.realtime_count}
                </span>
              </div>
            )}

            {freshness.stale_count > 0 && (
              <div className="board-metadata-banner__item board-metadata-banner__item--warning">
                <span className="board-metadata-banner__label">Stale:</span>
                <span className="board-metadata-banner__value">
                  <VerificationBadgeCompact freshness="stale" />
                  {freshness.stale_count}
                </span>
              </div>
            )}

            {freshness.orphaned_count > 0 && (
              <div className="board-metadata-banner__item board-metadata-banner__item--error">
                <span className="board-metadata-banner__label">Orphaned:</span>
                <span className="board-metadata-banner__value">
                  <VerificationBadgeCompact freshness="orphaned" />
                  {freshness.orphaned_count}
                </span>
              </div>
            )}
          </>
        )}

        {/* Last Sync */}
        <div className="board-metadata-banner__item">
          <span className="board-metadata-banner__label">Last sync:</span>
          <span className="board-metadata-banner__value">
            {formatTimestamp(last_updated)}
          </span>
        </div>

        {/* Unverified Count (if any) */}
        {unverifiedCount > 0 && (
          <div className="board-metadata-banner__item board-metadata-banner__item--highlight">
            <span className="board-metadata-banner__value">
              ⏳ {unverifiedCount} awaiting validation
            </span>
          </div>
        )}
      </div>

      {/* Refresh Button */}
      {onRefresh && (
        <button
          className="board-metadata-banner__refresh"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh board data"
        >
          <span className={`board-metadata-banner__refresh-icon ${isRefreshing ? 'board-metadata-banner__refresh-icon--spinning' : ''}`}>
            🔄
          </span>
          <span className="board-metadata-banner__refresh-label">
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </span>
        </button>
      )}
    </div>
  )
}
