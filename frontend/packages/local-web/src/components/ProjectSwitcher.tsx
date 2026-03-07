import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover'
import { useRepo } from '@vibe/app-core'
import { useRecentProjects } from '@vibe/app-core'
import { useState } from 'react'

interface ProjectSwitcherProps {
  onOpenFullSelector: () => void
}

export default function ProjectSwitcher({ onOpenFullSelector }: ProjectSwitcherProps) {
  const { repo, switchProject } = useRepo()
  const { recentRepos } = useRecentProjects()
  const [open, setOpen] = useState(false)

  const handleSelectProject = (selectedRepo: typeof recentRepos[0]) => {
    switchProject({
      owner: selectedRepo.owner,
      repo: selectedRepo.repo,
      full_name: selectedRepo.full_name,
    })
    setOpen(false)
  }

  const handleOpenFullSelector = () => {
    setOpen(false)
    onOpenFullSelector()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Switch project"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'transparent',
            border: '1px solid hsl(var(--_border))',
            borderRadius: 8,
            color: 'hsl(var(--text-high))',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'Instrument Sans, sans-serif',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'hsl(var(--_muted))'
            el.style.borderColor = 'hsl(var(--text-low))'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
            el.style.borderColor = 'hsl(var(--_border))'
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {repo?.full_name || 'No project'}
          </span>
          <CaretDownIcon
            size={14}
            style={{
              flexShrink: 0,
              transition: 'transform 0.15s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'hsl(var(--text-low))',
            }}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        sideOffset={4}
        align="start"
        onOpenAutoFocus={e => e.preventDefault()}
        style={{
          minWidth: 220,
          background: 'hsl(var(--_bg-secondary-default))',
          border: '1px solid hsl(var(--_border))',
          borderRadius: 10,
          padding: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          zIndex: 50,
          outline: 'none',
        }}
      >
        {recentRepos.length > 0 && (
          <>
            <div
              style={{
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 600,
                color: 'hsl(var(--text-low))',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Recent Projects
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
              {recentRepos.map(recentRepo => {
                const isCurrent = repo?.full_name === recentRepo.full_name
                return (
                  <button
                    key={recentRepo.full_name}
                    onClick={() => handleSelectProject(recentRepo)}
                    aria-label={`Switch to ${recentRepo.full_name}`}
                    aria-current={isCurrent ? 'true' : undefined}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 10px',
                      background: isCurrent ? 'hsl(var(--_muted))' : 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      color: 'hsl(var(--text-high))',
                      fontSize: 13,
                      fontWeight: isCurrent ? 500 : 400,
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => {
                      if (!isCurrent) {
                        e.currentTarget.style.background = 'hsl(var(--_muted))'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isCurrent) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {recentRepo.full_name}
                    </span>
                    {isCurrent && (
                      <CheckIcon
                        size={14}
                        weight="bold"
                        style={{ flexShrink: 0, color: 'var(--rb-accent)' }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
            <div
              style={{
                height: 1,
                background: 'hsl(var(--_border))',
                margin: '4px 0',
              }}
            />
          </>
        )}

        <button
          onClick={handleOpenFullSelector}
          aria-label="Switch to other project"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            color: 'hsl(var(--text-high))',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.1s',
            textAlign: 'left',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'hsl(var(--_muted))'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <span
            style={{
              fontSize: 16,
              lineHeight: 1,
              color: 'hsl(var(--text-low))',
            }}
          >
            +
          </span>
          <span>Switch to other...</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
