// Branch scanning and parallel feature fetching

import type { FileSnapshot, BranchError } from "../types/board.js";
import { GitHubClient } from "./github.js";

export class BranchScanner {
  private gh: GitHubClient;
  public errors: BranchError[] = [];

  constructor(token: string, owner: string, repo: string) {
    this.gh = new GitHubClient(token, owner, repo);
  }

  // ─── Task 1.4: Branch Discovery ───────────────────────────────────────

  async discoverBranches(
    patterns: string[] = ["user/*", "feature/*"],
  ): Promise<string[]> {
    const branchSet = new Set<string>();

    // Fetch branches for each pattern
    for (const pattern of patterns) {
      try {
        // Fetch all refs matching pattern (e.g., "heads/feature")
        const prefix = pattern.replace("/*", "");
        const refs = await this.gh.getRefs(`heads/${prefix}`);

        refs.forEach((r) => {
          branchSet.add(r.ref.replace("refs/heads/", ""));
        });
      } catch (error) {
        this.errors.push({
          branch: pattern,
          error: error instanceof Error ? error.message : String(error),
          type: "network",
        });
      }
    }

    // Convert Set to array
    const branches = Array.from(branchSet);

    // Always include main branch
    if (!branches.includes("main")) {
      branches.unshift("main");
    }

    return branches;
  }

  // ─── Task 1.5: Parallel Feature Fetching ──────────────────────────────

  async fetchAllFeatures(branches: string[]): Promise<FileSnapshot[]> {
    const snapshots: FileSnapshot[] = [];

    // Parallel fetch across branches using Promise.allSettled
    const results = await Promise.allSettled(
      branches.map((branch) => this.fetchBranchFeatures(branch)),
    );

    results.forEach((result, i) => {
      const branch = branches[i];

      if (result.status === "fulfilled") {
        snapshots.push(...result.value);
      } else {
        this.errors.push({
          branch,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          type: this.categorizeError(result.reason),
        });
      }
    });

    return snapshots;
  }

  private async fetchBranchFeatures(branch: string): Promise<FileSnapshot[]> {
    const snapshots: FileSnapshot[] = [];

    // Get all feature directories on this branch
    const featureDirs = await this.gh.listFeatureDirs(branch);

    // Parallel fetch files for each feature
    const featureResults = await Promise.allSettled(
      featureDirs.map((featureId) => this.fetchFeatureFiles(branch, featureId)),
    );

    featureResults.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value) {
        snapshots.push(result.value);
      }
      // Individual feature failures are not critical, silently skip
    });

    return snapshots;
  }

  private async fetchFeatureFiles(
    branch: string,
    featureId: string,
  ): Promise<FileSnapshot | null> {
    try {
      // Parallel fetch all three files
      const [meta, design, plan] = await Promise.all([
        this.gh.getFileContent(featureId, "meta.yaml", branch),
        this.gh.getFileContent(featureId, "dev-design.md", branch),
        this.gh.getFileContent(featureId, "dev-plan.md", branch),
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

  private categorizeError(error: unknown): BranchError["type"] {
    if (!(error instanceof Error)) return "network";

    const msg = error.message.toLowerCase();
    if (msg.includes("403") || msg.includes("permission")) return "permission";
    if (msg.includes("404") || msg.includes("not found")) return "not_found";
    if (msg.includes("rate limit")) return "rate_limit";
    return "network";
  }

  getRateLimitInfo() {
    return this.gh.getRateLimitInfo();
  }
}
