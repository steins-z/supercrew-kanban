import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBoard } from '../api.js'
import { useRepo } from './useRepo.js'
import type { FeatureBoard } from '../types.js'

const EMPTY_BOARD: FeatureBoard = {
  features: [],
  featuresByStatus: {
    planning: [], designing: [], ready: [], active: [], blocked: [], done: [],
  },
}

export function useBoard() {
  const queryClient = useQueryClient()
  const { repo } = useRepo()

  // Include repo in query key so it refetches when repo changes
  const queryKey = ['board', repo?.full_name ?? null] as const

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: fetchBoard,
    staleTime: 30_000,
    enabled: !!repo,  // Don't fetch if no repo selected
  })

  // Poll for data refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey })
    }, 30_000)
    return () => clearInterval(interval)
  }, [queryClient, queryKey[1]])

  const board = data ?? EMPTY_BOARD
  return {
    board,
    features: board.features,
    featuresByStatus: board.featuresByStatus,
    isLoading,
    error,
  }
}
