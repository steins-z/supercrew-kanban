---
status: draft
reviewers: []
---

# Quick Add Feature from Kanban — Technical Design

## Design Decisions

### 1. Modal-based UI Pattern

**Decision**: Use a modal dialog instead of inline form or separate page.

**Rationale**:
- Keeps user in context (on the kanban board)
- Familiar pattern (like RepoSelectModal, LocalRepoModal)
- Easy to dismiss and return to board
- Clear separation from board interaction

### 2. Backend API for Feature Creation

**Decision**: Create dedicated API endpoint instead of client-side Git operations.

**Rationale**:
- Git operations require Node.js/Bun runtime (not available in browser)
- Centralized validation and error handling
- Can support both local and GitHub modes
- Better error recovery and rollback

### 3. Auto-push to Remote

**Decision**: Automatically push feature branch to remote after creation.

**Rationale**:
- Aligns with user requirement "直接推到远端branch"
- Makes feature immediately visible in GitHub
- Enables collaboration right away
- Consistent with typical Git workflow

## Architecture

### Component Structure

```
BoardPage
└── Column (status="todo")
    ├── Header
    ├── Add Feature Button (+)  // NEW
    └── Card Container
        └── FeatureCards

CreateFeatureModal  // NEW
├── Form Fields
│   ├── Title (text input)
│   ├── ID (auto-generated, editable)
│   ├── Priority (select)
│   ├── Owner (text input, default: current user)
│   ├── Background (textarea)
│   ├── Requirements (textarea)
│   └── Out of Scope (textarea, optional)
├── Submit Button
└── Cancel Button
```

### API Design

**Endpoint**: `POST /api/features/create`

**Request**:
```typescript
{
  title: string;
  id: string;  // kebab-case
  priority: "P0" | "P1" | "P2" | "P3";
  owner: string;
  background: string;
  requirements: string;
  outOfScope?: string;
}
```

**Response** (Success):
```typescript
{
  success: true;
  featureId: string;
  branch: string;  // e.g., "user/luna-chen/my-feature"
  remotePushed: boolean;
}
```

**Response** (Error):
```typescript
{
  success: false;
  error: string;  // "Feature ID already exists", "Invalid ID format", etc.
}
```

### File Generation

**Files created**:
1. `.supercrew/tasks/<id>/meta.yaml`
2. `.supercrew/tasks/<id>/prd.md`

**Git workflow**:
1. Fetch `origin/main`
2. Create branch `user/<username>/<feature-id>` from `origin/main`
3. Create files
4. `git add .supercrew/tasks/<id>/`
5. `git commit -m "feat: Create <title>"`
6. `git push -u origin user/<username>/<feature-id>`

## Implementation Notes

### Frontend (React)

**Files to modify/create**:
- `frontend/packages/local-web/src/components/CreateFeatureModal.tsx` (new)
- `frontend/packages/local-web/src/routes/index.tsx` (add + button to Todo column)
- `frontend/packages/app-core/src/api.ts` (add createFeature API call)

**Form validation**:
- Title: required, min 3 chars
- ID: required, kebab-case format (`/^[a-z0-9]+(-[a-z0-9]+)*$/`)
- Priority: required, one of P0/P1/P2/P3
- Owner: required
- Background: required
- Requirements: required

### Backend (Hono + simple-git)

**Files to modify/create**:
- `backend/src/routes/features.ts` (new)
- `backend/src/services/feature-creator.ts` (new)
- `backend/src/index.ts` (register new routes)

**FeatureCreator service**:
```typescript
class FeatureCreator {
  constructor(private git: SimpleGit, private repoPath: string) {}

  async createFeature(data: CreateFeatureRequest): Promise<CreateFeatureResponse> {
    // 1. Validate input
    // 2. Check if feature ID already exists
    // 3. Get username from git config
    // 4. Create branch
    // 5. Create files
    // 6. Commit
    // 7. Push to remote
    // 8. Return result
  }
}
```

### Edge Cases

1. **Duplicate feature ID**: Check `.supercrew/tasks/<id>` existence before creating
2. **Invalid ID format**: Validate on both frontend and backend
3. **Git push failure**: Show error, allow retry, don't rollback local files
4. **Network issues**: Timeout handling, retry logic
5. **Permission errors**: Clear error message if push fails due to permissions

### Testing Checklist

- [ ] + button visible in Todo column
- [ ] Modal opens on click
- [ ] Form validation works
- [ ] ID auto-generation from title
- [ ] API creates files correctly
- [ ] Git branch created with correct name
- [ ] Files committed
- [ ] Branch pushed to remote
- [ ] Board refreshes after creation
- [ ] Error handling works
- [ ] Works in both local and GitHub modes
