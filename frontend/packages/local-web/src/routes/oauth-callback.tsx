import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { setToken, setUserInfo } from '@vibe/app-core'
import DotGrid from '@web/components/DotGrid'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/oauth-callback')({
  component: AuthCallback,
})

function AuthCallback() {
  const { t } = useTranslation()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')
    const error = params.get('error')

    if (accessToken) {
      setToken(accessToken)
      setUserInfo({
        login: params.get('login') ?? '',
        name: params.get('name') ?? '',
        avatar_url: params.get('avatar_url') ?? '',
      })
      // Use window.location for redirect to avoid TanStack Router hydration race
      // This ensures the redirect works on cold page loads in production
      window.location.href = '/'
    } else {
      window.location.href = `/login?error=${encodeURIComponent(error ?? 'unknown')}`
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#060010' }}>
      <DotGrid
        className="dot-grid-bg"
        dotSize={6}
        gap={28}
        baseColor="#1e1e3a"
        activeColor="#6060c0"
        proximity={130}
      />
      <div style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, letterSpacing: '0.02em' }}>
          {t('callback.signingIn')}
        </p>
      </div>
    </div>
  )
}
