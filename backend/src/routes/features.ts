// Features API routes

import { Hono } from 'hono';
import { FeatureCreator, type CreateFeatureRequest } from '../services/feature-creator.js';

export const featuresRouter = new Hono();

// POST /api/features/create - Create a new feature
featuresRouter.post('/create', async (c) => {
  try {
    const body = await c.req.json<CreateFeatureRequest>();

    // Validate required fields
    if (!body.title || !body.id || !body.priority || !body.owner || !body.background || !body.requirements) {
      return c.json({
        success: false,
        error: 'Missing required fields: title, id, priority, owner, background, requirements',
      }, 400);
    }

    // Validate priority
    if (!['P0', 'P1', 'P2', 'P3'].includes(body.priority)) {
      return c.json({
        success: false,
        error: 'Invalid priority. Must be one of: P0, P1, P2, P3',
      }, 400);
    }

    // Determine repo path
    const mode = c.req.query('mode') || 'github';
    const repoPath = mode === 'local-git'
      ? c.req.query('repo_path') || process.cwd()
      : process.cwd();

    console.log('[features/create] Creating feature:', body.id, 'at path:', repoPath);

    // Create feature
    const creator = new FeatureCreator(repoPath);
    const result = await creator.createFeature(body);

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result, 201);
  } catch (error) {
    console.error('[features/create] Error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
});
