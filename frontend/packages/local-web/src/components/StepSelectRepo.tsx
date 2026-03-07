import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MagnifyingGlassIcon, CaretDownIcon } from '@phosphor-icons/react'
import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover'
import { fetchUserRepos, type GitHubRepo } from '@vibe/app-core'
import { useTranslation } from 'react-i18next'

export function StepSelectRepo({
  selected,
  onSelect,
}: {
  selected: GitHubRepo | null
  onSelect: (r: GitHubRepo) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const { data: repos, isLoading } = useQuery<GitHubRepo[]>({
    queryKey: ['github-repos'],
    queryFn: fetchUserRepos,
  })

  const filtered = (repos ?? []).filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 4 }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>
          {t('welcome.step2.title')}
        </h3>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          {t('welcome.step2.description')}
        </p>
      </div>

      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch('') }}>
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
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected ? selected.full_name : t('welcome.step2.selectPlaceholder')}
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
          onOpenAutoFocus={e => e.preventDefault()}
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
                position: 'absolute', left: 9, top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.4)',
              }}
            />
            <input
              type="text"
              placeholder={t('welcome.step2.searchPlaceholder')}
              aria-label={t('welcome.step2.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
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

          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {isLoading ? (
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                {t('welcome.step2.loading')}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                {t('welcome.step2.noResults')}
              </div>
            ) : filtered.map(repo => {
              const isSelected = selected?.id === repo.id
              return (
                <button
                  key={repo.id}
                  onClick={() => { onSelect(repo); setOpen(false); setSearch('') }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: isSelected ? 'rgba(52,211,153,0.12)' : 'transparent',
                    border: `1px solid ${isSelected ? 'var(--rb-accent)' : 'transparent'}`,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ fontWeight: 500 }}>
                    {repo.full_name}
                  </div>
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
