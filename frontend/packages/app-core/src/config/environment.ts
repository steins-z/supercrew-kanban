// Environment configuration utilities

export const DEV_MODE = {
  GITHUB: 'github',
  LOCAL_GIT: 'local-git',
} as const;

export type DevMode = typeof DEV_MODE[keyof typeof DEV_MODE];

/**
 * Gets the current dev mode from environment
 * Defaults to 'github' if not set
 */
export function getDevMode(): DevMode {
  if (typeof import.meta.env === 'undefined') {
    return DEV_MODE.GITHUB;
  }
  const mode = import.meta.env.VITE_DEV_MODE as DevMode | undefined;
  return mode === DEV_MODE.LOCAL_GIT ? DEV_MODE.LOCAL_GIT : DEV_MODE.GITHUB;
}

/**
 * Checks if currently in local git mode
 */
export function isLocalGitMode(): boolean {
  return getDevMode() === DEV_MODE.LOCAL_GIT;
}

/**
 * Checks if currently in GitHub mode
 */
export function isGitHubMode(): boolean {
  return getDevMode() === DEV_MODE.GITHUB;
}
