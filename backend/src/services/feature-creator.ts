// Feature creation service - handles git operations and file creation

import { simpleGit, type SimpleGit } from 'simple-git';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface CreateFeatureRequest {
  title: string;
  id: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  owner: string;
  background: string;
  requirements: string;
  outOfScope?: string;
}

export interface CreateFeatureResponse {
  success: boolean;
  featureId?: string;
  branch?: string;
  remotePushed?: boolean;
  error?: string;
}

const TASKS_DIR = '.supercrew/tasks';

export class FeatureCreator {
  private git: SimpleGit;

  constructor(private repoPath: string) {
    this.git = simpleGit(this.repoPath);
  }

  async createFeature(data: CreateFeatureRequest): Promise<CreateFeatureResponse> {
    try {
      // 1. Validate input
      if (!this.validateFeatureId(data.id)) {
        return { success: false, error: 'Invalid feature ID format. Must be kebab-case.' };
      }

      // 2. Check if feature already exists
      const featurePath = join(this.repoPath, TASKS_DIR, data.id);
      if (existsSync(featurePath)) {
        return { success: false, error: `Feature ID "${data.id}" already exists.` };
      }

      // 3. Get username for branch
      const userName = await this.git.raw(['config', 'user.name']);
      const username = userName.trim().toLowerCase().replace(/\s+/g, '-');
      const branchName = `user/${username}/${data.id}`;

      // 4. Fetch and create branch from origin/main
      await this.git.fetch('origin', 'main');
      await this.git.checkout(['-b', branchName, 'origin/main']);

      // 5. Create feature directory and files
      mkdirSync(featurePath, { recursive: true });

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Create meta.yaml
      const metaContent = `id: ${data.id}
title: "${data.title}"
status: todo
owner: "${data.owner}"
priority: ${data.priority}
teams: []
tags: []
created: "${today}"
updated: "${today}"
`;
      writeFileSync(join(featurePath, 'meta.yaml'), metaContent);

      // Create prd.md
      const prdContent = `---
status: draft
reviewers: []
---

# ${data.title}

## Background

${data.background}

## Requirements

${data.requirements}

## Out of Scope

${data.outOfScope || 'To be defined'}
`;
      writeFileSync(join(featurePath, 'prd.md'), prdContent);

      // 6. Commit files
      await this.git.add([`${TASKS_DIR}/${data.id}/*`]);
      await this.git.commit(`feat: Create ${data.title}

Priority: ${data.priority}
Owner: ${data.owner}`);

      // 7. Push to remote
      let remotePushed = false;
      try {
        await this.git.push(['-u', 'origin', branchName]);
        remotePushed = true;
      } catch (pushError) {
        console.error('[FeatureCreator] Push failed:', pushError);
        // Don't fail the entire operation if push fails
        // User can manually push later
      }

      return {
        success: true,
        featureId: data.id,
        branch: branchName,
        remotePushed,
      };
    } catch (error) {
      console.error('[FeatureCreator] Error creating feature:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private validateFeatureId(id: string): boolean {
    // Must be kebab-case: lowercase letters, numbers, and hyphens only
    const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    return kebabCaseRegex.test(id);
  }
}
