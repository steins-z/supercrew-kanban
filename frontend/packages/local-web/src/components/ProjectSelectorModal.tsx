import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover'
import { CaretDownIcon } from '@phosphor-icons/react'
import { fetchUserRepos, type GitHubRepo, checkSupercrewExists } from '@vibe/app-core'
import { useRepo } from '@vibe/app-core'

interface ProjectSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ProjectSelectorModal({ open, onOpenChange }: ProjectSelectorModalProps) {
  const { switchProject } = useRepo()
  const [selectedRepo, setSelectedRepoState] = useState<GitHubRepo | null>(null)
  const [search, setSearch] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { data: repos, isLoading } = useQuery<GitHubRepo[]>({
    queryKey: ['github-repos'],
    queryFn: fetchUserRepos,
    enabled: open,
  })

  const filtered = (repos ?? []).filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSelectedRepoState(repo)
    setPopoverOpen(false)
    setSearch('')
  }

  const handleConfirm = async () => {
    if (!selectedRepo) return

    setIsVerifying(true)
    setErrorMsg('')

    try {
      // Check if repo has .supercrew/tasks/
      const exists = await checkSupercrewExists(selectedRepo.owner.login, selectedRepo.name)
      if (!exists) {
        setErrorMsg('This repository does not have a .supercrew/tasks/ directory')
        setIsVerifying(false)
        return
      }

      // Switch project
      switchProject({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        full_name: selectedRepo.full_name,
      })

      // Close modal
      onOpenChange(false)

      // Reset state
      setSelectedRepoState(null)
      setSearch('')
      setErrorMsg('')
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Failed to switch project')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setSelectedRepoState(null)
    setSearch('')
    setErrorMsg('')
    setIsVerifying(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
          }}
        />
        <Dialog.Content
          aria-describedby="project-selector-description"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'hsl(var(--_bg-secondary-default))',
            border: '1px solid hsl(var(--_border))',
            borderRadius: 12,
            padding: 24,
            width: '90vw',
            maxWidth: 480,
            maxHeight: '85vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            zIndex: 101,
            outline: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Dialog.Title
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'hsl(var(--text-high))',
                margin: 0,
              }}
            >
              Switch Project
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  background: 'transparent',
                  border: '1px solid hsl(var(--_border))',
                  borderRadius: 6,
                  color: 'hsl(var(--text-low))',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'hsl(var(--_muted))'
                  e.currentTarget.style.borderColor = 'hsl(var(--text-low))'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'hsl(var(--_border))'
                }}
              >
                <XIcon size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description
            id="project-selector-description"
            style={{
              fontSize: 13,
              color: 'hsl(var(--text-low))',
              margin: '-8px 0 0',
            }}
          >
            Select a repository to switch to. The repository must have a .supercrew/tasks/ directory.
          </Dialog.Description>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Popover open={popoverOpen} onOpenChange={(o) => { setPopoverOpen(o); if (!o) setSearch('') }}>
              <PopoverTrigger asChild>
                <button
                  aria-label="Select repository"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'hsl(var(--_bg-primary-default))',
                    border: `1px solid ${popoverOpen ? 'var(--rb-accent)' : 'hsl(var(--_border))'}`,
                    borderRadius: 8,
                    color: selectedRepo ? 'hsl(var(--text-high))' : 'hsl(var(--text-low))',
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
                    {selectedRepo ? selectedRepo.full_name : 'Select a repository...'}
                  </span>
                  <CaretDownIcon
                    size={14}
                    style={{
                      flexShrink: 0,
                      marginLeft: 8,
                      transition: 'transform 0.15s',
                      transform: popoverOpen ? 'rotate(180deg)' : 'rotate(0deg)',
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
                  width: 'var(--radix-popover-trigger-width)',
                  background: 'hsl(var(--_bg-secondary-default))',
                  border: '1px solid hsl(var(--_border))',
                  borderRadius: 10,
                  padding: 8,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  zIndex: 102,
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
                      color: 'hsl(var(--text-low))',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    aria-label="Search repositories"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 8px 7px 28px',
                      background: 'hsl(var(--_bg-primary-default))',
                      border: '1px solid hsl(var(--_border))',
                      borderRadius: 6,
                      color: 'hsl(var(--text-high))',
                      fontSize: 12.5,
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {isLoading ? (
                    <div style={{ color: 'hsl(var(--text-low))', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                      Loading repositories...
                    </div>
                  ) : filtered.length === 0 ? (
                    <div style={{ color: 'hsl(var(--text-low))', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                      No repositories found
                    </div>
                  ) : filtered.map(repo => {
                    const isSelected = selectedRepo?.id === repo.id
                    return (
                      <button
                        key={repo.id}
                        onClick={() => handleSelectRepo(repo)}
                        aria-label={`Select ${repo.full_name}`}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: isSelected ? 'hsl(var(--_muted))' : 'transparent',
                          border: 'none',
                          color: 'hsl(var(--text-high))',
                          cursor: 'pointer',
                          fontSize: 13,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.background = 'hsl(var(--_muted))'
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div style={{ fontWeight: isSelected ? 500 : 400 }}>
                          {repo.full_name}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {errorMsg && (
              <div
                style={{
                  padding: '10px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  color: '#fca5a5',
                  fontSize: 13,
                }}
              >
                {errorMsg}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              onClick={handleClose}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid hsl(var(--_border))',
                borderRadius: 8,
                color: 'hsl(var(--text-high))',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'hsl(var(--_muted))'
                e.currentTarget.style.borderColor = 'hsl(var(--text-low))'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'hsl(var(--_border))'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedRepo || isVerifying}
              style={{
                padding: '8px 20px',
                background: selectedRepo && !isVerifying ? 'var(--rb-accent)' : 'hsl(var(--_muted))',
                border: 'none',
                borderRadius: 8,
                color: selectedRepo && !isVerifying ? '#000' : 'hsl(var(--text-low))',
                fontSize: 13,
                fontWeight: 600,
                cursor: selectedRepo && !isVerifying ? 'pointer' : 'not-allowed',
                transition: 'opacity 0.15s',
                opacity: isVerifying ? 0.7 : 1,
              }}
            >
              {isVerifying ? 'Verifying...' : 'Switch Project'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
