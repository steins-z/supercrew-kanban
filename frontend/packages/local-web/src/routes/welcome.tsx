import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { LightningIcon, CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { isAuthenticated, checkSupercrewExists, setSelectedRepo, type GitHubRepo } from '@vibe/app-core'
import { useTranslation } from 'react-i18next'
import DotGrid from '@web/components/DotGrid'
import LangToggle from '@web/components/LangToggle'
import Stepper, { Step } from '@web/components/Stepper'
import { StepSelectRepo } from '@web/components/StepSelectRepo'

export const Route = createFileRoute('/welcome')({
  component: WelcomePage,
})

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function StepWelcome() {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '8px 0 16px', textAlign: 'center' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'linear-gradient(135deg, var(--rb-accent) 0%, var(--rb-accent2) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px var(--rb-glow)',
      }}>
        <LightningIcon size={22} weight="fill" color="#000" />
      </div>

      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>
          {t('welcome.step1.title')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            t('welcome.step1.feature1'),
            t('welcome.step1.feature2'),
            t('welcome.step1.feature3'),
          ].map(line => (
            <p key={line} style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Verify & Save ──────────────────────────────────────────────────

type BindStatus = 'loading' | 'success' | 'error'

function StepBind({
  repo,
  onSuccess,
}: {
  repo: GitHubRepo
  onSuccess: () => void
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<BindStatus>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const runBind = async () => {
    setStatus('loading')
    setErrorMsg('')
    try {
      // Check if repo has .supercrew/tasks/
      const exists = await checkSupercrewExists(repo.owner.login, repo.name)
      if (!exists) {
        setStatus('error')
        setErrorMsg(t('welcome.step3.noSupercrew'))
        return
      }

      // Save to localStorage
      setSelectedRepo({
        owner: repo.owner.login,
        repo: repo.name,
        full_name: repo.full_name,
      })

      setStatus('success')
      setTimeout(onSuccess, 1200)
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e.message ?? t('welcome.step3.unknownError'))
    }
  }

  useEffect(() => { runBind() }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 16, padding: '12px 0 20px', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 13, color: 'rgba(255,255,255,0.6)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, padding: '8px 14px',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        {repo.full_name}
      </div>

      {status === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--rb-accent)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            {t('welcome.step3.binding')}
          </p>
        </div>
      )}

      {status === 'success' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <CheckCircleIcon size={32} color="var(--rb-accent)" weight="fill" />
          <p style={{ fontSize: 13, color: 'var(--rb-accent)', margin: 0, fontWeight: 500 }}>
            {t('welcome.step3.success')}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <WarningCircleIcon size={30} color="#f87171" weight="fill" />
          <p style={{ fontSize: 13, color: '#fca5a5', margin: 0 }}>{errorMsg}</p>
          <button
            onClick={runBind}
            style={{
              padding: '8px 20px', borderRadius: 8,
              background: 'var(--rb-accent)', color: '#000',
              fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
            }}
          >
            {t('welcome.step3.retry')}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

function WelcomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedRepo, setSelectedRepoState] = useState<GitHubRepo | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: '/login', search: { error: undefined } })
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#060010' }}>
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

      <div style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
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
            <StepSelectRepo selected={selectedRepo} onSelect={setSelectedRepoState} />
          </Step>

          <Step>
            {selectedRepo ? (
              <StepBind repo={selectedRepo} onSuccess={() => navigate({ to: '/' })} />
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                {t('welcome.step3.noRepo')}
              </div>
            )}
          </Step>
        </Stepper>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
