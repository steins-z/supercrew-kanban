import { useState, useRef, useEffect } from 'react';
import { CaretDown, Check, X, Plus } from '@phosphor-icons/react';
import { useRepoSwitcher } from '@app/hooks/useRepoSwitcher';

export default function RepoSwitcher() {
  const { currentRepo, recentRepos, switchRepo, removeRepo, isLoading } = useRepoSwitcher();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle repo switching
  const handleSwitchRepo = (owner: string, repo: string) => {
    switchRepo(owner, repo);
    setIsOpen(false);
  };

  const handleRemoveRepo = (e: React.MouseEvent, owner: string, repo: string) => {
    e.stopPropagation();
    removeRepo(owner, repo);
  };

  // Display text for trigger button
  const displayText = currentRepo ? currentRepo.full : 'Select Repository';

  return (
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
            const isCurrent = repo.owner === currentRepo?.owner && repo.repo === currentRepo?.repo;
            const [isHovering, setIsHovering] = useState(false);

            return (
              <div
                key={`${repo.owner}/${repo.repo}`}
                onClick={() => !isCurrent && handleSwitchRepo(repo.owner, repo.repo)}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'hsl(var(--_muted))' : 'transparent',
                  color: isCurrent ? 'hsl(var(--text-high))' : 'hsl(var(--text-low))',
                  fontSize: 13,
                  fontWeight: isCurrent ? 600 : 500,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  {isCurrent && <Check size={14} weight="bold" />}
                  <span>
                    {repo.owner}/{repo.repo}
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
              // TODO: Trigger OAuth flow
              console.log('[RepoSwitcher] Connect another repo clicked');
              setIsOpen(false);
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
            <span>Connect Another Repo</span>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              padding: '16px 24px',
              background: 'hsl(var(--_bg-secondary-default))',
              borderRadius: 12,
              color: 'hsl(var(--text-high))',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Switching repository...
          </div>
        </div>
      )}
    </div>
  );
}
