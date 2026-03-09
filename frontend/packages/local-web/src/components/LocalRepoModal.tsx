import { useState } from 'react';
import { X, FolderOpen } from '@phosphor-icons/react';

interface LocalRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPath: (path: string) => void;
}

export default function LocalRepoModal({
  isOpen,
  onClose,
  onSelectPath,
}: LocalRepoModalProps) {
  const [repoPath, setRepoPath] = useState('');

  const handleSubmit = () => {
    console.log('[LocalRepoModal] handleSubmit called, repoPath:', repoPath);
    if (repoPath.trim()) {
      onSelectPath(repoPath.trim());
      onClose();
      setRepoPath('');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'hsl(var(--_bg-primary-default))',
          border: '1px solid hsl(var(--_border))',
          borderRadius: 16,
          width: 480,
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.24)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid hsl(var(--_border))',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: 'hsl(var(--text-high))',
              fontFamily: 'Instrument Sans, sans-serif',
            }}
          >
            Add Local Repository
          </h2>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'hsl(var(--text-low))',
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
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 500,
              color: 'hsl(var(--text-high))',
              fontFamily: 'Instrument Sans, sans-serif',
            }}
          >
            Repository Path
          </label>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              background: 'hsl(var(--_bg-secondary-default))',
              border: '1px solid hsl(var(--_border))',
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <FolderOpen size={16} color="hsl(var(--text-low))" weight="bold" />
            <input
              type="text"
              placeholder="e.g., /path/to/your/repo or d:\projects\my-repo"
              value={repoPath}
              onChange={(e) => {
                console.log('[LocalRepoModal] onChange:', e.target.value);
                setRepoPath(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit();
                }
              }}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'hsl(var(--text-high))',
                fontSize: 13,
                fontFamily: 'Instrument Sans, sans-serif',
              }}
              autoFocus
            />
          </div>

          <div
            style={{
              fontSize: 12,
              color: 'hsl(var(--text-low))',
              marginBottom: 20,
              fontFamily: 'Instrument Sans, sans-serif',
            }}
          >
            Enter the absolute path to your local git repository
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid hsl(var(--_border))',
                cursor: 'pointer',
                color: 'hsl(var(--text-high))',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'Instrument Sans, sans-serif',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'hsl(var(--_muted))';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'transparent';
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={repoPath.length === 0}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: repoPath.length > 0
                  ? 'hsl(var(--_accent))'
                  : 'hsl(var(--_muted))',
                border: 'none',
                cursor: repoPath.length > 0 ? 'pointer' : 'not-allowed',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'Instrument Sans, sans-serif',
                transition: 'background 0.15s, transform 0.1s',
                opacity: repoPath.length > 0 ? 1 : 0.5,
              }}
              onMouseEnter={(e) => {
                if (repoPath.length > 0) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = 'scale(1)';
              }}
            >
              Add Repository
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
