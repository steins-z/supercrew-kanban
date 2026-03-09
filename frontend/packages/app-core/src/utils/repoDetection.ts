// Repository detection utilities

export const REPO_OWNER_LOCAL = 'local' as const;

export type RepoType = 'github' | 'local';

/**
 * Determines if a repo identifier represents a local filesystem path
 * Checks for Windows (\) or Unix (/) path separators
 */
export function isLocalRepoPath(owner: string, repo: string): boolean {
  return owner === REPO_OWNER_LOCAL && (repo.includes('\\') || repo.includes('/'));
}

/**
 * Gets the repo type based on owner and repo values
 */
export function getRepoType(owner: string, repo: string): RepoType {
  return isLocalRepoPath(owner, repo) ? 'local' : 'github';
}

/**
 * Formats a repo identifier for display
 * - Local: shows full path (e.g., "D:\repo\project")
 * - GitHub: shows owner/repo format (e.g., "user/repo")
 */
export function formatRepoDisplay(owner: string, repo: string): string {
  return isLocalRepoPath(owner, repo) ? repo : `${owner}/${repo}`;
}

/**
 * Constructs the full repo identifier for storage
 * - Local: returns the path as-is
 * - GitHub: returns owner/repo format
 */
export function formatRepoFullName(owner: string, repo: string): string {
  return isLocalRepoPath(owner, repo) ? repo : `${owner}/${repo}`;
}
