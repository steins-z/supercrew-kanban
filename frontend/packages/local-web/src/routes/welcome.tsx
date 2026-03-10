import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LightningIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  CaretDownIcon,
} from '@phosphor-icons/react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@radix-ui/react-popover';
import {
  isAuthenticated,
  fetchUserRepos,
  checkSupercrewExists,
  setSelectedRepo,
  type GitHubRepo,
} from '@vibe/app-core';
import { useTranslation } from 'react-i18next';
import DotGrid from '@web/components/DotGrid';
import LangToggle from '@web/components/LangToggle';
import Stepper, { Step } from '@web/components/Stepper';

export const Route = createFileRoute('/welcome')({
  component: WelcomePage,
});

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function StepWelcome() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        padding: '8px 0 16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background:
            'linear-gradient(135deg, var(--rb-accent) 0%, var(--rb-accent2) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px var(--rb-glow)',
        }}
      >
        <LightningIcon size={22} weight="fill" color="#000" />
      </div>

      <div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#fff',
            margin: '0 0 10px',
          }}
        >
          {t('welcome.step1.title')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            t('welcome.step1.feature1'),
            t('welcome.step1.feature2'),
            t('welcome.step1.feature3'),
          ].map((line) => (
            <p
              key={line}
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.55)',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Select Repo ─────────────────────────────────────────────────────

function StepSelectRepo({
  selected,
  onSelect,
}: {
  selected: GitHubRepo | null;
  onSelect: (r: GitHubRepo) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  // Read default path from environment variable
  const [localRepoPath, setLocalRepoPath] = useState(
    (import.meta as any).env?.VITE_REPO_PATH || ''
  );

  // Check if local dev mode is enabled
  const isLocalMode = (import.meta as any).env?.VITE_DEV_MODE === 'local-git';

  const { data: repos, isLoading } = useQuery<GitHubRepo[]>({
    queryKey: ['github-repos'],
    queryFn: fetchUserRepos,
    enabled: !isLocalMode, // Only fetch repos if NOT in local mode
  });

  const filtered = (repos ?? []).filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  // Local mode UI
  if (isLocalMode) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingBottom: 4,
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#fff',
              margin: '0 0 4px',
            }}
          >
            {t('welcome.step2.title')}
          </h3>
          <p
            style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', margin: 0 }}
          >
            本地开发模式 - 使用本地 Git 仓库
          </p>
        </div>

        <div
          style={{
            background: 'rgba(96, 165, 250, 0.1)',
            border: '1px solid rgba(96, 165, 250, 0.3)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 12.5,
            color: 'rgba(96, 165, 250, 0.9)',
          }}
        >
          💡 本地模式下，将直接读取当前项目的 Git 仓库，无需 GitHub API
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.6)',
              marginBottom: 6,
            }}
          >
            本地仓库路径（留空默认使用当前项目目录）
          </label>
          <input
            type="text"
            value={localRepoPath}
            onChange={(e) => setLocalRepoPath(e.target.value)}
            placeholder="留空或填写绝对路径 (Windows: d:\repo\my-project, Mac: /Users/you/projects/my-project)"
            style={{
              width: '100%',
              padding: '9px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          onClick={() => {
            // Create a mock GitHubRepo object for local mode
            const mockRepo: GitHubRepo = {
              id: 0,
              full_name: localRepoPath || 'local-dev',
              name: localRepoPath ? localRepoPath.split('/').pop() || 'local-dev' : 'local-dev',
              owner: { login: 'local' },
              html_url: '',
            };
            onSelect(mockRepo);
          }}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: 'var(--rb-accent)',
            border: 'none',
            borderRadius: 8,
            color: '#000',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          使用本地仓库
        </button>
      </div>
    );
  }

  // GitHub mode UI (original)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        paddingBottom: 4,
      }}
    >
      <div>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#fff',
            margin: '0 0 4px',
          }}
        >
          {t('welcome.step2.title')}
        </h3>
        <p
          style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', margin: 0 }}
        >
          {t('welcome.step2.description')}
        </p>
      </div>

      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <button
            style={{
              width: '100%',
              padding: '9px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${open ? 'var(--rb-accent)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              color: selected ? '#fff' : 'rgba(255,255,255,0.35)',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selected
                ? selected.full_name
                : t('welcome.step2.selectPlaceholder')}
            </span>
            <CaretDownIcon
              size={14}
              style={{
                flexShrink: 0,
                marginLeft: 8,
                transition: 'transform 0.15s',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                color: 'rgba(255,255,255,0.5)',
              }}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{
            width: 'var(--radix-popover-trigger-width)',
            background: '#1c1c2e',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 50,
            outline: 'none',
          }}
        >
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <MagnifyingGlassIcon
              size={13}
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.4)',
              }}
            />
            <input
              type="text"
              placeholder={t('welcome.step2.searchPlaceholder')}
              aria-label={t('welcome.step2.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 8px 7px 28px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 12.5,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div
            style={{
              maxHeight: 200,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {isLoading ? (
              <div
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 13,
                  textAlign: 'center',
                  padding: '16px 0',
                }}
              >
                {t('welcome.step2.loading')}
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 13,
                  textAlign: 'center',
                  padding: '16px 0',
                }}
              >
                {t('welcome.step2.noResults')}
              </div>
            ) : (
              filtered.map((repo) => {
                const isSelected = selected?.id === repo.id;
                return (
                  <button
                    key={repo.id}
                    onClick={() => {
                      onSelect(repo);
                      setOpen(false);
                      setSearch('');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: isSelected
                        ? 'rgba(52,211,153,0.12)'
                        : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--rb-accent)' : 'transparent'}`,
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background =
                          'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{repo.full_name}</div>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Step 3: Verify & Save ──────────────────────────────────────────────────

type BindStatus = 'loading' | 'success' | 'error';

function StepBind({
  repo,
  onSuccess,
}: {
  repo: GitHubRepo;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<BindStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Check if local dev mode is enabled
  const isLocalMode = (import.meta as any).env?.VITE_DEV_MODE === 'local-git';

  const runBind = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      if (isLocalMode) {
        // Local mode: skip API check, directly save
        setSelectedRepo({
          owner: repo.owner.login,
          repo: repo.name,
          full_name: repo.full_name,
        });
        setStatus('success');
        setTimeout(onSuccess, 800);
        return;
      }

      // GitHub mode: check if repo has .supercrew/tasks/
      const exists = await checkSupercrewExists(repo.owner.login, repo.name);
      if (!exists) {
        setStatus('error');
        setErrorMsg(t('welcome.step3.noSupercrew'));
        return;
      }

      // Save to localStorage
      setSelectedRepo({
        owner: repo.owner.login,
        repo: repo.name,
        full_name: repo.full_name,
      });

      setStatus('success');
      setTimeout(onSuccess, 1200);
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message ?? t('welcome.step3.unknownError'));
    }
  };

  useEffect(() => {
    runBind();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '12px 0 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.6)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          padding: '8px 14px',
          fontFamily: 'IBM Plex Mono, monospace',
        }}
      >
        {repo.full_name}
      </div>

      {status === 'loading' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2.5px solid rgba(255,255,255,0.1)',
              borderTopColor: 'var(--rb-accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}
          >
            {t('welcome.step3.binding')}
          </p>
        </div>
      )}

      {status === 'success' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircleIcon size={32} color="var(--rb-accent)" weight="fill" />
          <p
            style={{
              fontSize: 13,
              color: 'var(--rb-accent)',
              margin: 0,
              fontWeight: 500,
            }}
          >
            {t('welcome.step3.success')}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <WarningCircleIcon size={30} color="#f87171" weight="fill" />
          <p style={{ fontSize: 13, color: '#fca5a5', margin: 0 }}>
            {errorMsg}
          </p>
          <button
            onClick={runBind}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              background: 'var(--rb-accent)',
              color: '#000',
              fontWeight: 600,
              fontSize: 13,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t('welcome.step3.retry')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

function WelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRepo, setSelectedRepoState] = useState<GitHubRepo | null>(
    null
  );

  // Check if local dev mode is enabled
  const isLocalMode = (import.meta as any).env?.VITE_DEV_MODE === 'local-git';

  useEffect(() => {
    // Only check authentication in GitHub mode
    if (!isLocalMode && !isAuthenticated()) {
      navigate({ to: '/login', search: { error: undefined } });
    }
  }, [isLocalMode]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#060010',
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 2 }}>
        <LangToggle />
      </div>

      <DotGrid
        className="dot-grid-bg"
        dotSize={6}
        gap={28}
        baseColor="#1e1e3a"
        activeColor="#6060c0"
        proximity={130}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Stepper
          initialStep={1}
          onStepChange={setCurrentStep}
          backButtonText={t('welcome.nav.back')}
          nextButtonText={t('welcome.nav.next')}
          nextButtonProps={{
            disabled: currentStep === 2 && !selectedRepo,
          }}
          onFinalStepCompleted={() => {}}
        >
          <Step>
            <StepWelcome />
          </Step>

          <Step>
            <StepSelectRepo
              selected={selectedRepo}
              onSelect={setSelectedRepoState}
            />
          </Step>

          <Step>
            {selectedRepo ? (
              <StepBind
                repo={selectedRepo}
                onSuccess={() => navigate({ to: '/' })}
              />
            ) : (
              <div
                style={{
                  padding: '20px 0',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 13,
                }}
              >
                {t('welcome.step3.noRepo')}
              </div>
            )}
          </Step>
        </Stepper>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
