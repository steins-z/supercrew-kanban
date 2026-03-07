---
status: draft
reviewers: []
---

# Database & Agent Reporting API — Technical Design

## Design Decisions

### Core Architecture Principle: Git as Ultimate Truth

**Decision**: Implement a hybrid architecture where Git remains the source of truth, while the database serves as a validated real-time cache.

**Rationale**:
- Git provides correctness guarantees (immutable history, code review, audit trail)
- Database provides speed (low latency reads, no GitHub API rate limits)
- Background validation reconciles the two, preferring Git when conflicts arise

**Trade-offs**:
- ✅ Pros: Best of both worlds (correctness + speed), graceful degradation
- ⚠️ Cons: Additional complexity (dual-write, validation queue, state reconciliation)

### Database Technology: Turso (libSQL)

**Decision**: Use Turso as the SQLite database provider.

**Rationale**:
- Serverless-native (works seamlessly with Vercel)
- HTTP-based API (no connection pooling issues in serverless)
- Built-in replication and global edge distribution
- Free tier sufficient for MVP (9GB storage, 1B row reads/month)

**Alternatives Considered**:
- better-sqlite3 (rejected: Vercel serverless has no persistent file system)
- PostgreSQL (rejected: overkill for this use case, requires hosted instance)
- Redis/KV (rejected: less structured, no SQL queries)

### Validation Strategy: Optimistic Write + Async Verification

**Decision**: Accept agent pushes immediately (optimistic), validate against Git asynchronously.

**Rationale**:
- Provides instant feedback to agents (low latency)
- Doesn't block on GitHub API calls
- Visual indicators let users know which data is verified

**Implementation**:
- Agent POST → write to DB with `verified=false`
- Queue validation job (priority-based)
- Background worker fetches from Git, compares hashes
- If match → mark verified; if mismatch → Git wins, update DB

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Supercrew Agent                        │
│                    (Local Claude Code)                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ POST /api/features/report
                 │ Authorization: Bearer <API_KEY>
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Hono on Vercel)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   API Routes │    │  Validation  │    │   Database   │ │
│  │              │───►│    Service   │◄──►│    Client    │ │
│  │  /features   │    │              │    │   (Turso)    │ │
│  │  /board      │    │  - Compare   │    └──────┬───────┘ │
│  │  /sync       │    │  - Reconcile │           │         │
│  └──────────────┘    └──────┬───────┘           │         │
│                             │                    │         │
│                             │ GitHub API         │ HTTP    │
│                             ▼                    ▼         │
└─────────────────────────────┼────────────────────┼─────────┘
                              │                    │
                    ┌─────────▼─────────┐  ┌──────▼────────┐
                    │   GitHub API      │  │  Turso Cloud  │
                    │  (Source of Truth)│  │   (SQLite)    │
                    └───────────────────┘  └───────────────┘
                              ▲
                              │ Read for verification
                    ┌─────────┴──────────┐
                    │  Vercel Cron Job   │
                    │  (every 1 minute)  │
                    │  - Process queue   │
                    │  - Validate        │
                    └────────────────────┘
```

### Data Flow

#### Write Path (Agent → DB)

```
1. Agent POST /api/features/report
   └─ Headers: Authorization (API key), Content-Type
   └─ Body: feature_id, branch, data (status, progress, files)

2. Backend validates API key
   └─ SHA256 hash lookup in api_keys table
   └─ Check: not expired, not revoked, matches repo

3. Write to database (unverified)
   └─ INSERT/UPDATE features table (source='agent', verified=false)
   └─ INSERT/UPDATE branches table (if branch specified)
   └─ Compute content_hash (MD5 of meta+design+plan)

4. Queue validation
   └─ INSERT into validation_queue (priority=1 for recent)
   └─ Avoid duplicates (UNIQUE constraint on repo+feature+branch)

5. Return 200 OK
   └─ Response: { ok: true, verified: false, queued_for_validation: true }
```

#### Read Path (UI → DB/Git)

```
1. Frontend GET /api/board
   └─ Query params: repo, branch_pattern, max_age

2. Backend reads from database
   └─ SELECT features WHERE repo_owner=? AND repo_name=?
   └─ Check freshness: verified AND (now - verified_at) < max_age

3. Freshness decision
   └─ If >50% stale → fallback to Git API (existing logic)
   └─ Else → return DB data with freshness indicators

4. Response enrichment
   └─ Add freshness field: 'verified' | 'realtime' | 'stale' | 'orphaned'
   └─ Add metadata: unverified_count, last_git_sync, queue_length

5. Frontend displays with visual indicators
   └─ ✅ Verified (green) | ⚡ Real-time (yellow pulse)
   └─ ⏳ Stale (orange) | ❌ Orphaned (red)
```

#### Validation Path (Background Worker)

```
1. Vercel Cron triggers (every minute)
   └─ GET /api/cron/validate
   └─ Auth: Bearer <CRON_SECRET>

2. Fetch validation jobs
   └─ SELECT * FROM validation_queue ORDER BY priority DESC, created_at
   └─ LIMIT 10 (process in batches)

3. For each job:
   a) Fetch from Git (source of truth)
      └─ GET /repos/{owner}/{repo}/contents/.supercrew/tasks/{id}/meta.yaml?ref={branch}
      └─ Use If-None-Match (ETag) to save API calls

   b) Get current DB state
      └─ SELECT * FROM features WHERE id=? AND repo_owner=? AND repo_name=?

   c) Compare content hashes
      └─ gitHash = MD5(git meta + design + plan)
      └─ dbHash = MD5(db meta + design + plan)

   d) Resolve conflict
      └─ If identical → UPDATE features SET verified=true, verified_at=now()
      └─ Else if Git newer → UPDATE features FROM git_data, verified=true
      └─ Else if agent newer → retry later (increment attempts)
      └─ Else → Git wins (update DB)

4. Delete processed jobs
   └─ DELETE FROM validation_queue WHERE id IN (...)
```

### Database Schema

See `docs/plans/2026-03-07-database-agent-reporting-design.md` for full schema definitions.

**Key Tables**:
- `features` — main feature state (status, progress, files, verification)
- `branches` — multi-branch support (same feature, different branches)
- `validation_queue` — pending validation jobs with priority
- `api_keys` — authentication for agent reporting

---

## Implementation Notes

### Rate Limit Optimization

GitHub API has a 5000 req/hour limit (authenticated). Strategies:

1. **ETag-based conditional requests**:
   ```typescript
   const headers = {
     'If-None-Match': dbFeature.git_etag  // from previous fetch
   }

   const res = await fetch(url, { headers })

   if (res.status === 304) {
     // Not modified - DB is correct, save 1 API call
     return { identical: true }
   }
   ```

2. **Batch validations**:
   - Process max 10 jobs per cron run
   - Prioritize recent updates (higher priority value)

3. **Smart queueing**:
   - Don't queue if already in queue (UNIQUE constraint)
   - Exponential backoff for retries (attempts field)

### Edge Cases

#### Case: Agent push for new feature (not yet in Git)

**Scenario**: Agent creates a feature locally, pushes to DB before committing to Git.

**Handling**:
- Write to DB with `source='agent'`, `verified=false`
- Validation fetches Git → 404 Not Found
- If feature age < 10 minutes → retry later (user may be committing)
- If feature age > 10 minutes → mark as `agent_orphaned` (warning in UI)

#### Case: Feature deleted from Git (but exists in DB)

**Scenario**: User deletes a feature from Git, but DB still has it.

**Handling**:
- Validation fetches Git → 404 Not Found
- Check DB feature age
- If old (>10 min) → mark as `source='agent_orphaned'`
- UI shows red ❌ badge: "Deleted from Git"

#### Case: Multi-branch conflict (same feature, different content on different branches)

**Scenario**: `main` has status=shipped, `feature/wip` has status=doing.

**Handling**:
- `features` table stores "canonical" state (usually from main)
- `branches` table stores per-branch state
- UI shows all branches with their individual states
- Main branch has higher priority in validation queue

#### Case: Content hash collision (extremely rare)

**Scenario**: MD5 collision (probability ~1 in 2^128).

**Handling**:
- Accept the risk (MD5 sufficient for non-cryptographic use)
- Git SHA always available as secondary verification
- If paranoid: upgrade to SHA256 (8x slower but collision-resistant)

### Security Considerations

#### API Key Management

- **Generation**: `crypto.randomBytes(32).toString('hex')` → 64 char hex string
- **Storage**: SHA256 hash only (never store plaintext)
- **Prefix**: `sk_live_` for production, `sk_test_` for dev (visual distinction)
- **Scope**: Per-repo (can't access other repos)
- **Rotation**: User can revoke and generate new keys
- **Expiration**: Optional (365 days default)

#### Injection Protection

- **SQL Injection**: Use parameterized queries (Turso client handles escaping)
  ```typescript
  await db.execute({
    sql: 'SELECT * FROM features WHERE id = ?',
    args: [featureId]  // safely escaped
  })
  ```

- **XSS Prevention**: Sanitize markdown content before rendering
  - Use react-markdown with safe defaults
  - No `dangerouslySetInnerHTML`

### Performance Optimization

#### Database Indexes

```sql
-- Fast repo lookups
CREATE INDEX idx_features_repo ON features(repo_owner, repo_name);

-- Fast status filtering
CREATE INDEX idx_features_status ON features(status);

-- Fast staleness checks
CREATE INDEX idx_features_verified ON features(verified, updated_at);

-- Fast queue processing
CREATE INDEX idx_queue_priority ON validation_queue(priority DESC, created_at);
```

#### Query Optimization

```typescript
// ❌ Bad: N+1 query problem
for (const feature of features) {
  const branches = await getBranches(feature.id)  // N queries
}

// ✅ Good: Single JOIN query
const featuresWithBranches = await db.execute({
  sql: `
    SELECT f.*, b.branch_name, b.status as branch_status
    FROM features f
    LEFT JOIN branches b ON f.id = b.feature_id
    WHERE f.repo_owner = ? AND f.repo_name = ?
  `,
  args: [owner, repo]
})
```

#### Caching Strategy

- **No in-memory cache**: Vercel serverless is stateless
- **Database IS the cache**: Turso is fast enough (<10ms reads)
- **Frontend QueryClient cache**: TanStack Query handles browser-side caching

### Testing Strategy

#### Unit Tests (Backend)

```typescript
// Test validation logic
describe('compareFeatureData', () => {
  it('should mark identical content as verified', () => {
    const gitData = { meta: 'foo', design: 'bar' }
    const dbData = { meta: 'foo', design: 'bar' }
    expect(compare(gitData, dbData)).toEqual({ identical: true })
  })

  it('should prefer Git when content differs', () => {
    const gitData = { meta: 'new', design: 'bar' }
    const dbData = { meta: 'old', design: 'bar' }
    expect(compare(gitData, dbData)).toEqual({ gitIsNewer: true })
  })
})
```

#### Integration Tests (API)

```bash
# Test agent report
curl -X POST http://localhost:3001/api/features/report \
  -H "Authorization: Bearer sk_test_abc123" \
  -H "Content-Type: application/json" \
  -d '{"repo_owner":"test","repo_name":"test","feature_id":"f1","data":{...}}'

# Expected: 200 OK, { ok: true, verified: false, queued_for_validation: true }
```

#### Manual Testing Checklist

- [ ] Agent can POST updates with valid API key
- [ ] Invalid API key returns 401 Unauthorized
- [ ] Expired API key returns 401
- [ ] Board shows unverified badge immediately after POST
- [ ] Validation cron runs and marks as verified within 60s
- [ ] Git mismatch triggers DB update
- [ ] Fallback to Git works when >50% features stale
- [ ] Manual sync button triggers immediate validation
- [ ] UI shows correct freshness indicators

---

## References

- Design document: `docs/plans/2026-03-07-database-agent-reporting-design.md`
- PRD: `.supercrew/tasks/database-agent-reporting-api/prd.md`
- Turso docs: https://docs.turso.tech/libsql/client-access
- Vercel cron: https://vercel.com/docs/cron-jobs/manage-cron-jobs
