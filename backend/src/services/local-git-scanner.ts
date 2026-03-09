// Local git repository scanner - bypasses GitHub API for development

import { simpleGit, type SimpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { FileSnapshot, BranchError } from '../types/board.js';

const FEATURES_PATH = '.supercrew/tasks';

export class LocalGitScanner {
  private git: SimpleGit;
  public errors: BranchError[] = [];

  constructor(private repoPath: string) {
    // Resolve to absolute path
    this.repoPath = resolve(repoPath);

    // Validate repo exists
    if (!existsSync(this.repoPath)) {
      throw new Error(`Repository path does not exist: ${this.repoPath}`);
    }

    this.git = simpleGit(this.repoPath);
  }

  // ─── Branch Discovery ──────────────────────────────────────────────────

  async discoverBranches(): Promise<string[]> {
    try {
      // Check if it's a valid git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error(`Not a git repository: ${this.repoPath}`);
      }

      // Get all branches (both local and remote)
      const branchSummary = await this.git.branch(['-a']);

      // Filter to include:
      // 1. Local branches (no prefix)
      // 2. Remote branches (remotes/origin/*) - strip prefix
      const branches = branchSummary.all
        .map((branch) => {
          // Remote branch: remotes/origin/feature-name -> feature-name
          if (branch.startsWith('remotes/origin/')) {
            return branch.replace('remotes/origin/', '');
          }
          // Local branch: use as-is
          return branch;
        })
        .filter((branch) => branch !== 'HEAD') // Skip HEAD pointer
        .filter((branch, index, self) => self.indexOf(branch) === index); // Deduplicate

      return branches;
    } catch (error) {
      this.errors.push({
        branch: 'all',
        error: error instanceof Error ? error.message : String(error),
        type: 'git', // Changed from 'network' to 'git' for local operations
      });
      return [];
    }
  }

  // ─── Feature Fetching ──────────────────────────────────────────────────

  async fetchAllFeatures(branches: string[]): Promise<FileSnapshot[]> {
    const snapshots: FileSnapshot[] = [];

    // Parallel fetch across branches
    const results = await Promise.allSettled(
      branches.map((branch) => this.fetchBranchFeatures(branch)),
    );

    results.forEach((result, i) => {
      const branch = branches[i];

      if (result.status === 'fulfilled') {
        snapshots.push(...result.value);
      } else {
        this.errors.push({
          branch,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          type: 'git', // Changed from 'network' to 'git' for local operations
        });
      }
    });

    return snapshots;
  }

  private async fetchBranchFeatures(branch: string): Promise<FileSnapshot[]> {
    const snapshots: FileSnapshot[] = [];

    // List feature directories on this branch
    const featureDirs = await this.listFeatureDirs(branch);

    // Parallel fetch files for each feature
    const featureResults = await Promise.allSettled(
      featureDirs.map((featureId) => this.fetchFeatureFiles(branch, featureId)),
    );

    featureResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        snapshots.push(result.value);
      }
      // Individual feature failures are not critical, silently skip
    });

    return snapshots;
  }

  private async fetchFeatureFiles(branch: string, featureId: string): Promise<FileSnapshot | null> {
    try {
      // Parallel fetch all three files
      const [meta, design, plan] = await Promise.all([
        this.getFileContent(branch, `${FEATURES_PATH}/${featureId}/meta.yaml`),
        this.getFileContent(branch, `${FEATURES_PATH}/${featureId}/dev-design.md`),
        this.getFileContent(branch, `${FEATURES_PATH}/${featureId}/dev-plan.md`),
      ]);

      return {
        branch,
        featureId,
        files: { meta, design, plan },
      };
    } catch (error) {
      // Feature file fetch failed, return null
      return null;
    }
  }

  // ─── Helper Methods ────────────────────────────────────────────────────

  private async listFeatureDirs(branch: string): Promise<string[]> {
    try {
      // Use git ls-tree to list directory contents
      const result = await this.git.raw(['ls-tree', '--name-only', `${branch}:${FEATURES_PATH}`]);

      // Parse output (one directory per line)
      return result
        .trim()
        .split('\n')
        .filter((name) => name.length > 0);
    } catch (error) {
      // Directory doesn't exist on this branch
      return [];
    }
  }

  private async getFileContent(branch: string, filePath: string): Promise<string | null> {
    try {
      // Use git show to read file content from specific branch
      const content = await this.git.show([`${branch}:${filePath}`]);
      // Return as base64 to match GitHub API format
      return Buffer.from(content, 'utf-8').toString('base64');
    } catch (error) {
      // File doesn't exist on this branch
      return null;
    }
  }
}
