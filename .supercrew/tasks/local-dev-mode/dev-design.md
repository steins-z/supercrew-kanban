---
status: draft
reviewers: []
---

# Local Dev Mode with Git Support — Technical Design

## Design Decisions

### Use simple-git Library

**Decision**: Use `simple-git` npm package for git operations.

**Rationale**:
- Mature, well-tested library (3M+ weekly downloads)
- Promise-based API, works well with async/await
- Supports all needed operations (branch list, show file content)
- Better than raw `child_process` - handles edge cases, escaping, error handling

**Alternative Considered**: `isomorphic-git` (pure JS, no git binary needed)
- **Rejected**: More complex, larger bundle, overkill for server-side use

### Mode Selection via Query Parameter

**Decision**: Use `?mode=local-git` query parameter to enable local mode.

**Rationale**:
- Simple to implement and test
- No state management needed
- Easy to switch between modes (just change URL)
- Backward compatible (defaults to `github` mode)

### Reuse Existing Data Pipeline

**Decision**: LocalGitScanner returns the same `FileSnapshot[]` format as BranchScanner.

**Rationale**:
- No changes needed to downstream processing (FeatureDiff, board logic)
- Data format already proven to work
- Easy to switch between local and remote modes

## Architecture

### Data Flow

```
Frontend → GET /api/board/multi-branch?mode=local-git&repo_path=/path/to/repo
              ↓
Backend: Check mode parameter
              ↓
         mode === 'local-git'?
              ↓ Yes
    LocalGitScanner.discoverBranches()
              ↓
    git branch --list (all branches)
              ↓
    LocalGitScanner.fetchAllFeatures(branches)
              ↓
    For each branch:
      git show branch:.supercrew/tasks/
      git show branch:.supercrew/tasks/feature-id/meta.yaml
      git show branch:.supercrew/tasks/feature-id/dev-design.md
      git show branch:.supercrew/tasks/feature-id/dev-plan.md
              ↓
    Return FileSnapshot[]
              ↓
    FeatureDiff.buildFeatureCards() (unchanged)
              ↓
    Return BoardResponse
```

### File Structure

```
backend/src/services/
├── github.ts                    (existing - GitHub API)
├── branch-scanner.ts            (existing - uses GitHub API)
├── local-git-scanner.ts         (NEW - uses git commands)
└── feature-diff.ts              (existing - unchanged)
```

### LocalGitScanner API

```typescript
export class LocalGitScanner {
  constructor(repoPath: string);

  async discoverBranches(): Promise<string[]>;
  async fetchAllFeatures(branches: string[]): Promise<FileSnapshot[]>;

  // Internal methods
  private async listFeatureDirs(branch: string): Promise<string[]>;
  private async getFileContent(branch: string, path: string): Promise<string | null>;
}
```

## Implementation Notes

### Git Commands Used

1. **List all branches**:
   ```bash
   git branch --list --format="%(refname:short)"
   ```
   Returns: `['main', 'feature/xyz', 'user/luna-chen/repo-switcher']`

2. **List directory contents**:
   ```bash
   git ls-tree --name-only branch:.supercrew/tasks/
   ```
   Returns: `['repo-switcher', 'scan-all-branches', 'local-dev-mode']`

3. **Read file content**:
   ```bash
   git show branch:.supercrew/tasks/feature-id/meta.yaml
   ```
   Returns: File content as string, or error if not exists

### Error Handling

**Case 1: Repo path doesn't exist**
- Check with `fs.existsSync(repoPath)`
- Return error: `{ error: 'Repository not found at path: ...' }`

**Case 2: Not a git repository**
- `git.checkIsRepo()` returns false
- Return error: `{ error: 'Not a git repository: ...' }`

**Case 3: Branch doesn't exist**
- Git command fails with 'invalid object name'
- Skip branch, add to errors array, continue

**Case 4: File doesn't exist**
- Git show fails with 'does not exist in branch'
- Return `null` for that file (same as GitHub API 404)

### Performance Considerations

**Parallel Execution**:
- Use `Promise.allSettled` for branches (same as BranchScanner)
- Limit concurrent git operations to avoid overwhelming system

**No Caching Needed**:
- Local git operations are fast (<10ms per file)
- Simpler than managing cache invalidation

### Repository Path Resolution

**Default**: `process.cwd()` - current working directory (repo root)

**Custom path**: Pass via `?repo_path=/absolute/path/to/repo`

**Security**: Only allow absolute paths, reject `..` and symlinks

### Integration with board.ts

```typescript
// Before
const scanner = new BranchScanner(token, owner, repo);
const branches = await scanner.discoverBranches(scanAll);

// After
const mode = c.req.query('mode') || 'github';

let branches: string[];
let snapshots: FileSnapshot[];

if (mode === 'local-git') {
  const repoPath = c.req.query('repo_path') || process.cwd();
  const localScanner = new LocalGitScanner(repoPath);
  branches = await localScanner.discoverBranches();
  snapshots = await localScanner.fetchAllFeatures(branches);
} else {
  const scanner = new BranchScanner(token, owner, repo);
  branches = await scanner.discoverBranches(scanAll);
  snapshots = await scanner.fetchAllFeatures(branches);
}

// Rest of the logic remains the same
const differ = new FeatureDiff(snapshots);
const features = differ.buildFeatureCards();
// ...
```

### Testing Strategy

1. **Unit tests**: Mock git commands, test LocalGitScanner methods
2. **Integration test**: Use actual test repo with known branches/files
3. **Manual test**: `curl 'http://localhost:3000/api/board/multi-branch?mode=local-git'`
4. **Compare outputs**: Ensure local mode returns same format as GitHub mode
