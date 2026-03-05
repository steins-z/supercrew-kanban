// GitHub API client for reading .supercrew/features/

import type {
  FeatureMeta,
  FeatureBoard,
  Feature,
  DesignDoc,
  PlanDoc,
  SupercrewStatus,
} from "./types.js";
import { getAccessToken, clearToken } from "./auth.js";

const GH_API = "https://api.github.com";

function ghHeaders() {
  const token = getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return {
    Authorization: `Bearer ${token}`,
    "User-Agent": "supercrew-kanban",
  };
}

async function ghFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${GH_API}${path}`, { headers: ghHeaders() });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

function decodeContent(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

// Parse YAML frontmatter from markdown
function parseFrontmatter(content: string): {
  data: Record<string, any>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, body: content };

  const yamlStr = match[1];
  const body = match[2].trim();

  // Simple YAML parser for our use case
  const data: Record<string, any> = {};
  for (const line of yamlStr.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: any = line.slice(colonIdx + 1).trim();

    // Handle arrays
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s: string) => s.trim().replace(/['"]/g, ""))
        .filter(Boolean);
    }
    // Handle quoted strings
    else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Handle numbers
    else if (!isNaN(Number(value)) && value !== "") {
      value = Number(value);
    }

    data[key] = value;
  }

  return { data, body };
}

// Simple YAML parser for meta.yaml files
function parseYaml(content: string): Record<string, any> {
  const data: Record<string, any> = {};
  let currentKey = "";
  let inArray = false;
  let arrayItems: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Array item
    if (trimmed.startsWith("- ") && inArray) {
      arrayItems.push(trimmed.slice(2).replace(/['"]/g, ""));
      continue;
    }

    // End previous array
    if (inArray && !trimmed.startsWith("- ")) {
      data[currentKey] = arrayItems;
      inArray = false;
      arrayItems = [];
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    // Start of array
    if (value === "" || value === "[]") {
      currentKey = key;
      inArray = true;
      arrayItems = [];
      continue;
    }

    // Inline array
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/['"]/g, ""))
        .filter(Boolean);
      continue;
    }

    // Regular value
    let parsed: any = value;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      parsed = value.slice(1, -1);
    } else if (!isNaN(Number(value)) && value !== "") {
      parsed = Number(value);
    }
    data[key] = parsed;
  }

  // Handle trailing array
  if (inArray) {
    data[currentKey] = arrayItems;
  }

  return data;
}

const FEATURES_PATH = ".supercrew/features";

// ─── Repo Selection ─────────────────────────────────────────────────────────

const REPO_KEY = "kanban_repo";

export interface RepoInfo {
  owner: string;
  repo: string;
  full_name: string;
}

export function getSelectedRepo(): RepoInfo | null {
  const stored = localStorage.getItem(REPO_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// Internal - use setSelectedRepo from useRepo hook instead
function _setSelectedRepo(repo: RepoInfo) {
  localStorage.setItem(REPO_KEY, JSON.stringify(repo));
}

// Re-export for internal use by useRepo hook
export { _setSelectedRepo as setSelectedRepoInternal };

export function clearSelectedRepo() {
  localStorage.removeItem(REPO_KEY);
}

// ─── GitHub Repos ───────────────────────────────────────────────────────────

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  html_url: string;
}

export async function fetchUserRepos(): Promise<GitHubRepo[]> {
  const repos = await ghFetch<GitHubRepo[]>(
    "/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member",
  );
  return repos ?? [];
}

export async function checkSupercrewExists(
  owner: string,
  repo: string,
): Promise<boolean> {
  const result = await ghFetch<any>(
    `/repos/${owner}/${repo}/contents/${FEATURES_PATH}`,
  );
  return result !== null;
}

// ─── Features ───────────────────────────────────────────────────────────────

export async function fetchFeatures(): Promise<FeatureMeta[]> {
  const repo = getSelectedRepo();
  if (!repo) return [];

  const dirs = await ghFetch<{ name: string; type: string }[]>(
    `/repos/${repo.owner}/${repo.repo}/contents/${FEATURES_PATH}`,
  );
  if (!dirs) return [];

  const featureDirs = dirs.filter((d) => d.type === "dir");
  const metas = await Promise.all(
    featureDirs.map((d) => fetchFeatureMeta(d.name)),
  );
  return metas.filter(Boolean) as FeatureMeta[];
}

async function fetchFeatureMeta(id: string): Promise<FeatureMeta | null> {
  const repo = getSelectedRepo();
  if (!repo) return null;

  const file = await ghFetch<{ content: string }>(
    `/repos/${repo.owner}/${repo.repo}/contents/${FEATURES_PATH}/${id}/meta.yaml`,
  );
  if (!file) return null;

  const raw = parseYaml(decodeContent(file.content));
  return {
    id: raw.id ?? id,
    title: raw.title ?? "",
    status: raw.status ?? "todo",
    owner: raw.owner ?? "",
    priority: raw.priority ?? "P2",
    teams: raw.teams ?? [],
    target_release: raw.target_release,
    created: raw.created ?? "",
    updated: raw.updated ?? "",
    tags: raw.tags ?? [],
    blocked_by: raw.blocked_by ?? [],
  } as FeatureMeta;
}

export async function fetchFeature(id: string): Promise<Feature | null> {
  const meta = await fetchFeatureMeta(id);
  if (!meta) return null;

  const [design, plan] = await Promise.all([
    fetchFeatureDesign(id),
    fetchFeaturePlan(id),
  ]);

  return {
    meta,
    design: design ?? undefined,
    plan: plan ?? undefined,
  };
}

export async function fetchFeatureDesign(
  id: string,
): Promise<DesignDoc | null> {
  const repo = getSelectedRepo();
  if (!repo) return null;

  const file = await ghFetch<{ content: string }>(
    `/repos/${repo.owner}/${repo.repo}/contents/${FEATURES_PATH}/${id}/design.md`,
  );
  if (!file) return null;

  const { data, body } = parseFrontmatter(decodeContent(file.content));
  return {
    status: data.status ?? "draft",
    reviewers: data.reviewers ?? [],
    approved_by: data.approved_by,
    body,
  };
}

export async function fetchFeaturePlan(id: string): Promise<PlanDoc | null> {
  const repo = getSelectedRepo();
  if (!repo) return null;

  const file = await ghFetch<{ content: string }>(
    `/repos/${repo.owner}/${repo.repo}/contents/${FEATURES_PATH}/${id}/plan.md`,
  );
  if (!file) return null;

  const { data, body } = parseFrontmatter(decodeContent(file.content));
  return {
    total_tasks: data.total_tasks ?? 0,
    completed_tasks: data.completed_tasks ?? 0,
    progress: data.progress ?? 0,
    body,
  };
}

export async function fetchBoard(): Promise<FeatureBoard> {
  const features = await fetchFeatures();
  const featuresByStatus: Record<SupercrewStatus, FeatureMeta[]> = {
    todo: [],
    doing: [],
    "ready-to-ship": [],
    shipped: [],
  };

  for (const f of features) {
    // Map unknown statuses to 'done' as fallback
    const status = featuresByStatus[f.status] !== undefined ? f.status : "done";
    featuresByStatus[status].push(f);
  }

  return { features, featuresByStatus };
}
