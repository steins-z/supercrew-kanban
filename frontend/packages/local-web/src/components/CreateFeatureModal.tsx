import { useState } from 'react';
import { X } from '@phosphor-icons/react';
import { createFeature, type CreateFeatureRequest } from '@app/api';

interface CreateFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Convert title to kebab-case
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CreateFeatureModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateFeatureModalProps) {
  const [title, setTitle] = useState('');
  const [id, setId] = useState('');
  const [priority, setPriority] = useState<'P0' | 'P1' | 'P2' | 'P3'>('P2');
  const [owner, setOwner] = useState('');
  const [background, setBackground] = useState('');
  const [requirements, setRequirements] = useState('');
  const [outOfScope, setOutOfScope] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-generate ID from title
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!id) {
      setId(toKebabCase(value));
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!id.trim()) {
      setError('Feature ID is required');
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
      setError('Feature ID must be kebab-case (lowercase, hyphens only)');
      return;
    }
    if (!owner.trim()) {
      setError('Owner is required');
      return;
    }
    if (!background.trim()) {
      setError('Background is required');
      return;
    }
    if (!requirements.trim()) {
      setError('Requirements are required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data: CreateFeatureRequest = {
        title,
        id,
        priority,
        owner,
        background,
        requirements,
        outOfScope: outOfScope || undefined,
      };

      const result = await createFeature(data);

      if (!result.success) {
        setError(result.error || 'Failed to create feature');
        setLoading(false);
        return;
      }

      // Success
      console.log('[CreateFeatureModal] Feature created:', result);
      setLoading(false);

      // Reset form
      setTitle('');
      setId('');
      setPriority('P2');
      setOwner('');
      setBackground('');
      setRequirements('');
      setOutOfScope('');

      onClose();
      onSuccess();
    } catch (err) {
      console.error('[CreateFeatureModal] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setLoading(false);
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
          borderRadius: 12,
          width: 520,
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.24)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid hsl(var(--_border))',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: 'hsl(var(--text-high))',
              fontFamily: 'Instrument Sans, sans-serif',
            }}
          >
            Create New Feature
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

        {/* Body - Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {error && (
            <div
              style={{
                padding: '10px 12px',
                background: 'hsl(var(--destructive) / 0.1)',
                border: '1px solid hsl(var(--destructive))',
                borderRadius: 6,
                color: 'hsl(var(--destructive))',
                marginBottom: 12,
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {/* Title */}
          <label style={labelStyle}>
            Title <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g., User Authentication"
            style={inputStyle}
            disabled={loading}
          />

          {/* Feature ID */}
          <label style={labelStyle}>
            Feature ID <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
          </label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="e.g., user-auth"
            style={inputStyle}
            disabled={loading}
          />
          <div style={hintStyle}>Lowercase, hyphens only (kebab-case)</div>

          {/* Priority */}
          <label style={labelStyle}>
            Priority <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            style={selectStyle}
            disabled={loading}
          >
            <option value="P0">P0 - Critical</option>
            <option value="P1">P1 - High</option>
            <option value="P2">P2 - Medium</option>
            <option value="P3">P3 - Low</option>
          </select>

          {/* Owner */}
          <label style={labelStyle}>
            Owner <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
          </label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="e.g., Luna Chen"
            style={inputStyle}
            disabled={loading}
          />

          {/* Background */}
          <label style={labelStyle}>
            Background <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
          </label>
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="Why is this feature needed?"
            style={textareaStyle}
            rows={2}
            disabled={loading}
          />

          {/* Requirements */}
          <label style={labelStyle}>
            Requirements <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
          </label>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="What must this feature do?"
            style={textareaStyle}
            rows={2}
            disabled={loading}
          />

          {/* Out of Scope */}
          <label style={labelStyle}>Out of Scope (Optional)</label>
          <textarea
            value={outOfScope}
            onChange={(e) => setOutOfScope(e.target.value)}
            placeholder="What is NOT included?"
            style={textareaStyle}
            rows={2}
            disabled={loading}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            padding: '12px 16px',
            borderTop: '1px solid hsl(var(--_border))',
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: 'transparent',
              border: '1px solid hsl(var(--_border))',
              color: 'hsl(var(--text-high))',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: loading ? 'hsl(var(--_muted))' : 'hsl(var(--_accent))',
              border: 'none',
              color: '#fff',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating...' : 'Create Feature'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Styles
const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 5,
  marginTop: 10,
  fontSize: 12,
  fontWeight: 500,
  color: 'hsl(var(--text-high))',
  fontFamily: 'Instrument Sans, sans-serif',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'hsl(var(--_bg-secondary-default))',
  border: '1px solid hsl(var(--_border))',
  borderRadius: 6,
  color: 'hsl(var(--text-high))',
  fontSize: 12,
  fontFamily: 'Instrument Sans, sans-serif',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical' as const,
  minHeight: 60,
};

const hintStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'hsl(var(--text-low))',
  marginTop: 3,
  fontFamily: 'Instrument Sans, sans-serif',
};

const buttonStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'Instrument Sans, sans-serif',
  cursor: 'pointer',
  transition: 'all 0.15s',
};
