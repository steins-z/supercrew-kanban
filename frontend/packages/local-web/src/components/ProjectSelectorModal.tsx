import * as Dialog from '@radix-ui/react-dialog'
import { XIcon } from '@phosphor-icons/react'
import { useRepo, type GitHubRepo } from '@vibe/app-core'
import { StepSelectRepo } from './StepSelectRepo'

interface ProjectSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ProjectSelectorModal({ open, onOpenChange }: ProjectSelectorModalProps) {
  const { repo, switchProject } = useRepo()

  const handleSelect = (selectedRepo: GitHubRepo) => {
    // Skip if already on this project
    if (repo?.full_name === selectedRepo.full_name) {
      onOpenChange(false)
      return
    }

    switchProject({
      owner: selectedRepo.owner.login,
      repo: selectedRepo.name,
      full_name: selectedRepo.full_name,
    })
    onOpenChange(false)
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
            background: '#1c1c2e',
            border: '1px solid rgba(255,255,255,0.12)',
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
                color: '#fff',
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
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
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
              color: 'rgba(255,255,255,0.5)',
              margin: '-8px 0 0',
            }}
          >
            Select a repository to switch to.
          </Dialog.Description>

          <StepSelectRepo selected={null} onSelect={handleSelect} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
