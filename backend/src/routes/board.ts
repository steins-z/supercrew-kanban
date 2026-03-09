// Multi-branch board API endpoint

import { Hono } from 'hono'
import type { BoardResponse } from '../types/board.js'
import type { SupercrewStatus } from '../types/shared.js'
import { BranchScanner } from '../services/branch-scanner.js'
import { FeatureDiff } from '../services/feature-diff.js'

export const boardRouter = new Hono()

boardRouter.get('/multi-branch', async (c) => {
  // ─── Extract Parameters ────────────────────────────────────────────

  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  const owner = c.req.header('X-Repo-Owner')
  const repo = c.req.header('X-Repo-Name')
  const branchPattern = c.req.query('branch_pattern') ?? 'feature/*'

  if (!token) {
    return c.json({ error: 'Missing Authorization header' }, 401)
  }

  if (!owner || !repo) {
    return c.json(
      {
        error: 'Missing required headers: X-Repo-Owner, X-Repo-Name',
      },
      400,
    )
  }

  // ─── Scan Branches ────────────────────────────────────────────────

  try {
    const scanner = new BranchScanner(token, owner, repo)

    // Step 1: Discover branches
    const branches = await scanner.discoverBranches(branchPattern)

    if (branches.length === 0) {
      return c.json({
        features: [],
        featuresByStatus: {},
        metadata: {
          scannedBranches: [],
          totalBranches: 0,
          fetchedAt: new Date().toISOString(),
          errors: scanner.errors,
        },
      } as BoardResponse)
    }

    // Step 2: Fetch all features from all branches
    const snapshots = await scanner.fetchAllFeatures(branches)

    // Step 3: Compute diffs and build cards
    const differ = new FeatureDiff(snapshots)
    const features = differ.buildFeatureCards()

    // Step 4: Group by status
    const featuresByStatus: Record<SupercrewStatus, typeof features> = {
      todo: [],
      doing: [],
      'ready-to-ship': [],
      shipped: [],
    }

    for (const feature of features) {
      // Map unknown statuses to fallback value
      const status =
        featuresByStatus[feature.status] !== undefined
          ? feature.status
          : 'shipped'
      featuresByStatus[status].push(feature)
    }

    // ─── Return Response ──────────────────────────────────────────────

    const response: BoardResponse = {
      features,
      featuresByStatus,
      metadata: {
        scannedBranches: branches,
        totalBranches: branches.length,
        fetchedAt: new Date().toISOString(),
        errors: scanner.errors,
      },
    }

    return c.json(response)
  } catch (error) {
    console.error('[board/multi-branch] Error:', error)

    return c.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      500,
    )
  }
})
