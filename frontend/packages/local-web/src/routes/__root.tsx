import {
  Outlet,
  createRootRoute,
  useRouterState,
  useNavigate,
} from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SquaresFourIcon, LightningIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import AppHeader from '@web/components/AppHeader';
import Dock from '@web/components/Dock';
import {
  isAuthenticated,
  clearToken,
  getSelectedRepo,
  clearSelectedRepo,
} from '@vibe/app-core';
import type { DockItemConfig } from '@web/components/Dock';

const PUBLIC_PATHS = ['/login', '/oauth-callback', '/welcome'];

function RootLayout() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('crew-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem('crew-theme');
    if (saved) setDark(saved === 'dark');
  }, []);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  // Route guard: redirect to /login if not authenticated on protected routes
  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return;
    if (!isAuthenticated()) {
      navigate({ to: '/login', search: { error: undefined } });
    }
  }, [pathname]);

  // FRE detection: if authenticated but no repo selected, go to /welcome
  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return;
    if (!isAuthenticated()) return;

    const repo = getSelectedRepo();
    if (!repo) {
      navigate({ to: '/welcome' });
    }
  }, [pathname]);

  function handleLogout() {
    clearToken();
    clearSelectedRepo();
    queryClient.clear();
    void navigate({ to: '/login', search: { error: undefined } });
  }

  function handleDisconnect() {
    const ok = window.confirm(t('sidebar.disconnectConfirm'));
    if (!ok) return;
    clearSelectedRepo();
    queryClient.clear();
    void navigate({ to: '/welcome' });
  }

  // Show full-page layout (no dock) for public routes
  if (PUBLIC_PATHS.includes(pathname)) {
    return <Outlet />;
  }

  const isActive = (to: string, exact = false) =>
    exact ? pathname === to : pathname.startsWith(to);

  const iconColor = (to: string, exact = false) =>
    isActive(to, exact) ? 'var(--rb-accent)' : 'hsl(var(--text-low))';

  const iconWeight = (to: string, exact = false): 'fill' | 'regular' =>
    isActive(to, exact) ? 'fill' : 'regular';

  const dockItems: DockItemConfig[] = [
    {
      icon: <LightningIcon size={17} weight="fill" color="var(--rb-accent)" />,
      label: 'Super Crew',
      className: '',
    },
    {
      icon: (
        <SquaresFourIcon
          size={17}
          weight={iconWeight('/', true)}
          color={iconColor('/', true)}
        />
      ),
      label: t('nav.board'),
      onClick: () => navigate({ to: '/' }),
      className: isActive('/', true) ? 'dock-item-active' : '',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'hsl(var(--_background))',
      }}
    >
      <AppHeader
        dark={dark}
        onToggleTheme={() => setDark((d) => !d)}
        onLogout={handleLogout}
        onDisconnect={handleDisconnect}
      />

      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </main>

      <div
        style={{
          flexShrink: 0,
          height: 74,
          position: 'relative',
          zIndex: 10,
          overflow: 'visible',
        }}
      >
        <Dock
          items={dockItems}
          baseItemSize={40}
          magnification={62}
          panelHeight={58}
          dockHeight={196}
          distance={110}
        />
      </div>
    </div>
  );
}

export const Route = createRootRoute({ component: RootLayout });
