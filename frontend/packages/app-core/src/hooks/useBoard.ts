import { useEffect, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBoardMultiBranch, fetchBoardFromDb } from '../api.js'
import { useRepo } from './useRepo.js'
import type { FeatureBoard } from '../types.js'

const EMPTY_BOARD: FeatureBoard = {
  features: [],
  featuresByStatus: {
    todo: [], doing: [], 'ready-to-ship': [], shipped: [],
  },
}

export interface UseBoardOptions {
  mode?: 'git' | 'database'
  enablePolling?: boolean
}

export function useBoard(options: UseBoardOptions = {}) {
  const { mode = 'git', enablePolling = true } = options
  const queryClient = useQueryClient()
  const { repo } = useRepo()
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Include repo and mode in query key so it refetches when either changes
  const queryKey = ['board', mode, repo?.full_name ?? null] as const

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: mode === 'database' ? fetchBoardFromDb : fetchBoardMultiBranch,
    staleTime: mode === 'database' ? 5_000 : 30_000,  // DB mode: 5s, Git mode: 30s
    enabled: !!repo,  // Don't fetch if no repo selected
  })

  const board = data ?? EMPTY_BOARD

  // Calculate smart polling interval based on freshness
  const getPollingInterval = useCallback(() => {
    if (!enablePolling || mode !== 'database') {
      return 5 * 60 * 1000  // 5 minutes for Git mode or when polling disabled
    }

    // Check if any features are unverified
    const hasUnverifiedFeatures = board.features.some(f => !f.verified)

    // Fast polling (30s) if unverified features exist, slow polling (5min) otherwise
    return hasUnverifiedFeatures ? 30_000 : 5 * 60 * 1000
  }, [board.features, enablePolling, mode])

  // Smart polling with dynamic interval
  useEffect(() => {
    if (!enablePolling) return

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey })
      setLastRefresh(new Date())
    }, getPollingInterval())

    return () => clearInterval(interval)
  }, [queryClient, enablePolling, getPollingInterval, queryKey[1], queryKey[2]])

  // Manual refresh
  const refresh = useCallback(async () => {
    await refetch()
    setLastRefresh(new Date())
  }, [refetch])

  // Get unverified count
  const unverifiedCount = board.features.filter(f => !f.verified).length

  return {
    board,
    features: board.features,
    featuresByStatus: board.featuresByStatus,
    metadata: board.metadata,
    isLoading,
    error,
    refresh,
    lastRefresh,
    unverifiedCount,
    mode,
  }
}
