import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CaretDown, Check, X, Plus } from '@phosphor-icons/react';
import { useRepoSwitcher } from '@app/hooks/useRepoSwitcher';
import { useRepo } from '@app/hooks/useRepo';
import RepoSelectModal from './RepoSelectModal';
import LocalRepoModal from './LocalRepoModal';

export default function RepoSwitcher() {
  const { repo: currentRepo } = useRepo(); // Get current repo from useRepo
  const { recentRepos, addRepo, removeRepo } = useRepoSwitcher();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredRepo, setHoveredRepo] = useState<string | null>(null); // Track hovered repo by ID
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [showLocalModal, setShowLocalModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if we're in local-git mode
  const isLocalMode = import.meta.env.VITE_DEV_MODE === 'local-git';

  // Add current repo to recent repos when it changes
  useEffect(() => {
    if (currentRepo) {
      // For local mode, pass full_name as repo to preserve the path
      // For GitHub mode, pass the repo name
      if (isLocalMode) {
        addRepo(currentRepo.owner, currentRepo.full_name);
      } else {
        addRepo(currentRepo.owner, currentRepo.repo);
      }
    }
  }, [currentRepo, addRepo, isLocalMode]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle repo switching
  const handleSwitchRepo = (owner: string, repo: string) => {
    // For local mode, repo IS the path, so pass it as repo_path
    // For GitHub mode, pass owner and repo separately
    const isLocalRepo = owner === 'local' && (repo.includes('\\') || repo.includes('/'));

    if (isLocalRepo) {
      window.location.href = `/?mode=local-git&repo_path=${encodeURIComponent(repo)}`;
    } else {
      window.location.href = `/?owner=${owner}&repo=${repo}`;
    }
  };

  const handleRemoveRepo = (
    e: React.MouseEvent,
    owner: string,
    repo: string
  ) => {
    e.stopPropagation();
    removeRepo(owner, repo);
  };

  // Display text for trigger button
  const displayText = currentRepo
    ? isLocalMode && (currentRepo.repo.includes('\\') || currentRepo.repo.includes('/'))
      ? currentRepo.repo  // Show full path for local repos
      : `${currentRepo.owner}/${currentRepo.repo}`  // Show owner/repo for GitHub repos
    : 'Select Repository';

  return (
    <>
      <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '6px 10px',
          borderRadius: 8,
          color: 'hsl(var(--text-low))',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'Instrument Sans, sans-serif',
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
        <span>{displayText}</span>
        <CaretDown size={12} weight="bold" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            minWidth: 240,
            background: 'hsl(var(--_bg-secondary-default))',
            border: '1px solid hsl(var(--_border))',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            zIndex: 1000,
            padding: 8,
          }}
        >
          {/* Empty State */}
          {recentRepos.length === 0 && (
            <div
              style={{
                padding: '16px 12px',
                textAlign: 'center',
                color: 'hsl(var(--text-low))',
                fontSize: 13,
              }}
            >
              No repositories yet
            </div>
          )}

          {/* Recent Repos List */}
          {recentRepos.map((repo) => {
            const repoId = `${repo.owner}/${repo.repo}`;
            const isCurrent =
              currentRepo &&
              repo.owner === currentRepo.owner &&
              repo.repo === currentRepo.repo;
            const isHovering = hoveredRepo === repoId;

            // For local repos, show just the path; for GitHub repos, show owner/repo
            const isLocalRepo = repo.owner === 'local' && (repo.repo.includes('\\') || repo.repo.includes('/'));
            const displayText = isLocalRepo ? repo.repo : `${repo.owner}/${repo.repo}`;

            return (
              <div
                key={repoId}
                onClick={() =>
                  !isCurrent && handleSwitchRepo(repo.owner, repo.repo)
                }
                onMouseEnter={() => setHoveredRepo(repoId)}
                onMouseLeave={() => setHoveredRepo(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'hsl(var(--_muted))' : 'transparent',
                  color: isCurrent
                    ? 'hsl(var(--text-high))'
                    : 'hsl(var(--text-low))',
                  fontSize: 13,
                  fontWeight: isCurrent ? 600 : 500,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                  }}
                >
                  {isCurrent && <Check size={14} weight="bold" />}
                  <span>
                    {displayText}
                  </span>
                </div>

                {/* Remove Button (show on hover, hide for current repo) */}
                {!isCurrent && isHovering && (
                  <button
                    onClick={(e) => handleRemoveRepo(e, repo.owner, repo.repo)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'hsl(var(--text-low))',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = 'hsl(var(--destructive))';
                      el.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = 'transparent';
                      el.style.color = 'hsl(var(--text-low))';
                    }}
                  >
                    <X size={12} weight="bold" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Divider */}
          {recentRepos.length > 0 && (
            <div
              style={{
                height: 1,
                background: 'hsl(var(--_border))',
                margin: '8px 0',
              }}
            />
          )}

          {/* Connect Another Repo CTA */}
          <div
            onClick={() => {
              setIsOpen(false);
              if (isLocalMode) {
                // Local mode: show path input modal
                setShowLocalModal(true);
              } else {
                // GitHub mode: show repo selection modal
                setShowRepoModal(true);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              background: 'transparent',
              color: 'hsl(var(--text-low))',
              fontSize: 13,
              fontWeight: 500,
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
            <Plus size={14} weight="bold" />
            <span>{isLocalMode ? 'Add Local Repository' : 'Connect Another Repo'}</span>
          </div>
        </div>
      )}
    </div>

    {/* Modals */}
    <RepoSelectModal
      isOpen={showRepoModal}
      onClose={() => setShowRepoModal(false)}
      onSelectRepo={(owner, repo) => {
        setShowRepoModal(false);
        handleSwitchRepo(owner, repo);
      }}
    />

    <LocalRepoModal
      isOpen={showLocalModal}
      onClose={() => setShowLocalModal(false)}
      onSelectPath={(path) => {
        setShowLocalModal(false);
        // For local mode, use path as repo identifier
        window.location.href = `/?mode=local-git&repo_path=${encodeURIComponent(path)}`;
      }}
    />
  </>
  );
}
