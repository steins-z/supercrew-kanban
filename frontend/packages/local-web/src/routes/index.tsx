import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useBoard } from '@app/hooks/useBoard';
import { useRepo } from '@app/hooks/useRepo';
import type { FeatureMeta, FeaturePriority, SupercrewStatus } from '@app/types';
import SpotlightCard from '@web/components/SpotlightCard';
import CountUp from '@web/components/CountUp';
import ClickSpark from '@web/components/ClickSpark';
import AnimatedCard from '@web/components/AnimatedCard';

// ─── Column config ──────────────────────────────────────────────────────────

const STATUS_COLUMN_IDS: SupercrewStatus[] = [
  'todo',
  'doing',
  'ready-to-ship',
  'shipped',
];

const STATUS_KEY_MAP: Record<SupercrewStatus, string> = {
  todo: 'board.columns.todo',
  doing: 'board.columns.doing',
  'ready-to-ship': 'board.columns.readyToShip',
  shipped: 'board.columns.shipped',
};

function getStatusKey(status: SupercrewStatus): string {
  return status;
}

const PRI_CLASS: Record<FeaturePriority, string> = {
  P0: 'rb-p0',
  P1: 'rb-p1',
  P2: 'rb-p2',
  P3: 'rb-p3',
};

// ─── Board ──────────────────────────────────────────────────────────────────

function BoardPage() {
  const { t } = useTranslation();
  const { featuresByStatus, isLoading } = useBoard();
  const navigate = useNavigate();
  const { selectRepo } = useRepo();
  const searchParams = Route.useSearch();

  // Handle URL params for repo selection (from RepoSwitcher)
  useEffect(() => {
    const { owner, repo, repo_path, mode } = searchParams;

    if (owner && repo) {
      // GitHub mode: owner/repo params
      selectRepo({ owner, repo, full_name: `${owner}/${repo}` });
      // Clean up URL params (use replace to avoid history spam)
      void navigate({
        to: '/',
        search: { owner: undefined, repo: undefined, repo_path: undefined, mode: undefined },
        replace: true,
      });
    } else if (repo_path) {
      // Local mode: repo_path param
      // Use path as both owner and repo for display
      const pathName = repo_path.split(/[/\\]/).pop() || 'local-repo';
      selectRepo({ owner: 'local', repo: pathName, full_name: repo_path });
      // Clean up URL params but keep mode (use replace to avoid history spam)
      void navigate({
        to: '/',
        search: { owner: undefined, repo: undefined, repo_path: undefined, mode },
        replace: true,
      });
    }
  }, [searchParams, selectRepo, navigate]);

  const STATUS_COLUMNS = STATUS_COLUMN_IDS.map((id) => ({
    id,
    name: t(STATUS_KEY_MAP[id]),
  }));

  const isDark = document.documentElement.classList.contains('dark');

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(var(--text-low))',
          fontFamily: 'Instrument Sans, sans-serif',
          fontSize: 13,
        }}
      >
        {t('board.loading')}
      </div>
    );
  }

  return (
    <div
      className="rb-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── Kanban board with ClickSpark ── */}
      <div
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '16px 18px',
        }}
      >
        <ClickSpark
          sparkColor={isDark ? '#34d399' : '#10b981'}
          sparkCount={7}
          sparkRadius={22}
          sparkSize={7}
        >
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              minWidth: 'max-content',
              padding: 2,
            }}
          >
            {STATUS_COLUMNS.map((col) => (
              <Column
                key={col.id}
                col={col}
                features={featuresByStatus[col.id] ?? []}
                isDark={isDark}
                onCardClick={(id) =>
                  void navigate({ to: '/features/$id', params: { id } })
                }
              />
            ))}
          </div>
        </ClickSpark>
      </div>
    </div>
  );
}

// ─── Column ─────────────────────────────────────────────────────────────────

function Column({
  col,
  features,
  isDark,
  onCardClick,
}: {
  col: { id: SupercrewStatus; name: string };
  features: FeatureMeta[];
  isDark: boolean;
  onCardClick: (id: string) => void;
}) {
  const sk = getStatusKey(col.id);

  return (
    <div style={{ width: 264, flexShrink: 0 }}>
      {/* Header */}
      <div
        className={`rb-col-${sk}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 11px',
          background: 'hsl(var(--_bg-secondary-default))',
          border: '1px solid hsl(var(--_border))',
          borderBottom: 'none',
          borderRadius: '10px 10px 0 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className={`rb-dot rb-dot-${sk}`} />
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'hsl(var(--text-high))',
              fontFamily: 'Instrument Sans, sans-serif',
            }}
          >
            {col.name}
          </span>
          <span style={{ fontSize: 10, color: 'hsl(var(--text-low))' }}>
            <CountUp
              key={features.length}
              to={features.length}
              duration={0.6}
              className="rb-mono"
            />
          </span>
        </div>
      </div>

      {/* Card area (read-only, no drag) */}
      <div
        style={{
          background: 'hsl(var(--_bg-secondary-default))',
          border: '1px solid hsl(var(--_border))',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          minHeight: 120,
          padding: 7,
        }}
      >
        {features.map((feature, index) => (
          <AnimatedCard key={feature.id} index={index}>
            <div
              onClick={() => onCardClick(feature.id)}
              style={{ cursor: 'pointer' }}
            >
              <FeatureCard feature={feature} statusKey={sk} isDark={isDark} />
            </div>
          </AnimatedCard>
        ))}
      </div>
    </div>
  );
}

// ─── Feature card visual (SpotlightCard) ────────────────────────────────────

function FeatureCard({
  feature,
  statusKey,
  isDark,
}: {
  feature: FeatureMeta;
  statusKey: string;
  isDark: boolean;
}) {
  return (
    <SpotlightCard
      className={`rb-card rb-lift rb-glass rb-bar-${statusKey}`}
      spotlightColor={isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'}
      style={{
        background: 'hsl(var(--_bg-primary-default))',
        padding: '9px 11px',
        marginBottom: 6,
        cursor: 'pointer',
      }}
    >
      {/* ID + priority row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            className="rb-mono"
            style={{ color: 'hsl(var(--text-low))', fontSize: 9.5 }}
          >
            {feature.id}
          </span>
          {feature.primaryBranch &&
            feature.branches &&
            feature.branches.length > 0 && (
              <span
                className="rb-mono rb-branch-tag"
                style={{
                  fontSize: 8.5,
                  padding: '1px 5px',
                  background: 'hsl(var(--_accent-dim))',
                  border: '1px solid hsl(var(--_accent))',
                  color: 'hsl(var(--text-high))',
                }}
                title={`Primary branch: ${feature.primaryBranch}`}
              >
                {feature.primaryBranch}
              </span>
            )}
          {feature.branches && feature.branches.some((b) => b.isDifferent) && (
            <span
              style={{
                fontSize: 8.5,
                padding: '1px 5px',
                background: 'hsl(var(--_warning-dim, 40 80% 95%))',
                border: '1px solid hsl(var(--_warning, 40 80% 60%))',
                color: 'hsl(var(--_warning, 40 80% 40%))',
                borderRadius: '4px',
                fontWeight: 600,
              }}
              title="This feature has different versions in other branches"
            >
              ⚠ Multiple versions
            </span>
          )}
        </div>
        {feature.priority && (
          <span
            className={`rb-mono ${PRI_CLASS[feature.priority]}`}
            style={{ fontSize: 9.5 }}
          >
            {feature.priority}
          </span>
        )}
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: 'hsl(var(--text-high))',
          lineHeight: 1.45,
          margin: 0,
          fontFamily: 'Instrument Sans, sans-serif',
        }}
      >
        {feature.title}
      </p>

      {/* Tags + Teams */}
      {((feature.tags && feature.tags.length > 0) ||
        (feature.teams && feature.teams.length > 0)) && (
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}
        >
          {(feature.teams ?? []).slice(0, 2).map((team) => (
            <span key={team} className="rb-tag" style={{ opacity: 0.7 }}>
              {team}
            </span>
          ))}
          {(feature.tags ?? []).slice(0, 2).map((tag) => (
            <span key={tag} className="rb-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Branch Tags - only show if there are multiple versions */}
      {feature.branches &&
        feature.branches.length > 0 &&
        feature.branches.some((b) => b.isDifferent) && (
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}
          >
            {feature.branches.map((branch) => (
              <span
                key={branch.branch}
                className="rb-tag rb-branch-tag"
                title={`Branch: ${branch.branch} (different content)`}
                style={{
                  fontSize: 9,
                  opacity: 1,
                  background: 'hsl(var(--_accent-dim))',
                  border: '1px solid hsl(var(--_accent))',
                }}
              >
                {branch.branch}
              </span>
            ))}
          </div>
        )}

      {/* Owner */}
      {feature.owner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid hsl(var(--_border))',
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--rb-accent-dim)',
              border: '1px solid var(--rb-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
              fontWeight: 700,
              color: 'var(--rb-accent)',
              flexShrink: 0,
            }}
          >
            {feature.owner.charAt(0).toUpperCase()}
          </div>
          <span
            style={{
              fontSize: 10.5,
              color: 'hsl(var(--text-low))',
              fontFamily: 'Instrument Sans, sans-serif',
            }}
          >
            {feature.owner}
          </span>
        </div>
      )}
    </SpotlightCard>
  );
}

export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>) => ({
    owner: s.owner as string | undefined,
    repo: s.repo as string | undefined,
    repo_path: s.repo_path as string | undefined,
    mode: s.mode as string | undefined,
  }),
  component: BoardPage,
});
