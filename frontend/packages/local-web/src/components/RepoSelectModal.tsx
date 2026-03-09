import { useState, useEffect } from 'react';
import { X, Check, MagnifyingGlass } from '@phosphor-icons/react';
import { fetchUserRepos, checkSupercrewExists, type GitHubRepo } from '@app/api';

interface RepoSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRepo: (owner: string, repo: string) => void;
}

export default function RepoSelectModal({
  isOpen,
  onClose,
  onSelectRepo,
}: RepoSelectModalProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkingRepos, setCheckingRepos] = useState<Set<string>>(new Set());
  const [supercrewRepos, setSupercrewRepos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadRepos();
    }
  }, [isOpen]);

  async function loadRepos() {
    setLoading(true);
    try {
      const userRepos = await fetchUserRepos();
      setRepos(userRepos);

      // Check which repos have .supercrew directory (in parallel)
      const checks = userRepos.map(async (repo) => {
        const hasSupercrew = await checkSupercrewExists(
          repo.owner.login,
          repo.name,
        );
        return { fullName: repo.full_name, hasSupercrew };
      });

      setCheckingRepos(new Set(userRepos.map((r) => r.full_name)));

      const results = await Promise.all(checks);
      const supercrewSet = new Set<string>();
      results.forEach(({ fullName, hasSupercrew }) => {
        if (hasSupercrew) {
          supercrewSet.add(fullName);
        }
      });

      setSupercrewRepos(supercrewSet);
      setCheckingRepos(new Set());
    } catch (error) {
      console.error('[RepoSelectModal] Failed to load repos:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRepos = repos.filter(
    (repo) =>
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'hsl(var(--_bg-primary-default))',
          border: '1px solid hsl(var(--_border))',
          borderRadius: 16,
          width: 540,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.24)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid hsl(var(--_border))',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: 'hsl(var(--text-high))',
              fontFamily: 'Instrument Sans, sans-serif',
            }}
          >
            Select Repository
          </h2>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'hsl(var(--text-low))',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'hsl(var(--_muted))';
              el.style.color = 'hsl(var(--text-high))';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'transparent';
              el.style.color = 'hsl(var(--text-low))';
            }}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--_border))' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: 'hsl(var(--_bg-secondary-default))',
              border: '1px solid hsl(var(--_border))',
              borderRadius: 8,
            }}
          >
            <MagnifyingGlass size={16} color="hsl(var(--text-low))" weight="bold" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'hsl(var(--text-high))',
                fontSize: 13,
                fontFamily: 'Instrument Sans, sans-serif',
              }}
            />
          </div>
        </div>

        {/* Repo List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 20px',
          }}
        >
          {loading && (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'hsl(var(--text-low))',
                fontSize: 13,
              }}
            >
              Loading repositories...
            </div>
          )}

          {!loading && filteredRepos.length === 0 && (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'hsl(var(--text-low))',
                fontSize: 13,
              }}
            >
              No repositories found
            </div>
          )}

          {!loading &&
            filteredRepos.map((repo) => {
              const hasSupercrew = supercrewRepos.has(repo.full_name);
              const isChecking = checkingRepos.has(repo.full_name);

              return (
                <div
                  key={repo.id}
                  onClick={() => {
                    if (hasSupercrew) {
                      onSelectRepo(repo.owner.login, repo.name);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    marginBottom: 6,
                    borderRadius: 8,
                    background: hasSupercrew
                      ? 'hsl(var(--_bg-secondary-default))'
                      : 'transparent',
                    border: '1px solid hsl(var(--_border))',
                    cursor: hasSupercrew ? 'pointer' : 'default',
                    opacity: hasSupercrew ? 1 : 0.5,
                    transition: 'background 0.15s, transform 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (hasSupercrew) {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = 'hsl(var(--_muted))';
                      el.style.transform = 'translateX(2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (hasSupercrew) {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = 'hsl(var(--_bg-secondary-default))';
                      el.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: hasSupercrew
                          ? 'hsl(var(--text-high))'
                          : 'hsl(var(--text-low))',
                        fontFamily: 'Instrument Sans, sans-serif',
                        marginBottom: 4,
                      }}
                    >
                      {repo.full_name}
                    </div>
                    {!hasSupercrew && !isChecking && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'hsl(var(--text-low))',
                          fontFamily: 'Instrument Sans, sans-serif',
                        }}
                      >
                        No .supercrew directory
                      </div>
                    )}
                    {isChecking && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'hsl(var(--text-low))',
                          fontFamily: 'Instrument Sans, sans-serif',
                        }}
                      >
                        Checking...
                      </div>
                    )}
                  </div>

                  {hasSupercrew && (
                    <Check size={16} weight="bold" color="hsl(var(--text-high))" />
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
