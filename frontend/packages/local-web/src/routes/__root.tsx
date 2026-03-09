import {
  Outlet,
  createRootRoute,
  useRouterState,
  useNavigate,
} from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import AppHeader from '@web/components/AppHeader';
import {
  isAuthenticated,
  clearToken,
  getSelectedRepo,
  clearSelectedRepo,
} from '@vibe/app-core';

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

  // Show full-page layout for public routes
  if (PUBLIC_PATHS.includes(pathname)) {
    return <Outlet />;
  }

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
    </div>
  );
}

export const Route = createRootRoute({ component: RootLayout });
