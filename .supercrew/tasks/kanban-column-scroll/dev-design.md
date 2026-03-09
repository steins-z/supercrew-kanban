---
status: draft
reviewers: []
---

# Kanban Column Scrolling — Technical Design

## Design Decisions

### 1. CSS-based Scrolling Solution

**Decision**: Use pure CSS with `maxHeight` and `overflowY: auto` instead of JavaScript scrolling libraries.

**Rationale**:
- Simple and performant
- Native browser support
- No additional dependencies
- Works well with existing React component structure

### 2. Height Calculation Strategy

**Decision**: Use `calc(100vh - 220px)` for `maxHeight`.

**Rationale**:
- `100vh` = full viewport height
- Subtract fixed elements:
  - AppHeader: ~60px
  - Dock: ~74px
  - Column header: ~40px
  - Padding and margins: ~46px
- Total: 220px overhead
- Ensures columns fit within viewport

## Architecture

### Component Structure

```
BoardPage
└── Column (width: 264px, flexShrink: 0)
    ├── Header (fixed, not scrollable)
    │   ├── Status dot
    │   ├── Column name
    │   └── Card count
    └── Card Container (NEW: scrollable)
        ├── maxHeight: calc(100vh - 220px)
        ├── overflowY: auto
        └── FeatureCard[] (mapped with AnimatedCard wrapper)
```

### CSS Changes

**File**: `frontend/packages/local-web/src/routes/index.tsx`

**Current** (line ~207-215):
```tsx
<div style={{
  background: 'hsl(var(--_bg-secondary-default))',
  border: '1px solid hsl(var(--_border))',
  borderTop: 'none',
  borderRadius: '0 0 10px 10px',
  minHeight: 120,
  padding: 7,
}}>
```

**New**:
```tsx
<div style={{
  background: 'hsl(var(--_bg-secondary-default))',
  border: '1px solid hsl(var(--_border))',
  borderTop: 'none',
  borderRadius: '0 0 10px 10px',
  minHeight: 120,
  maxHeight: 'calc(100vh - 220px)', // NEW
  overflowY: 'auto',                 // NEW
  padding: 7,
}}>
```

## Implementation Notes

### Testing Checklist

- [ ] Scroll works with mouse wheel
- [ ] Scroll works with touchpad
- [ ] Scroll works with dragging scrollbar
- [ ] Scrollbar visible only when content overflows
- [ ] Column header stays fixed at top
- [ ] Horizontal scroll still works for board
- [ ] Works in both light and dark themes
- [ ] No layout shift when scrollbar appears

### Edge Cases

1. **Short columns**: `minHeight: 120` ensures columns don't collapse when empty
2. **Scrollbar width**: Native scrollbar may cause slight width variation - acceptable
3. **Browser compatibility**: `calc()` and `overflowY` supported in all modern browsers

### Performance Considerations

- No virtualization needed for <100 cards per column
- CSS scrolling is hardware-accelerated
- AnimatedCard components already memoized
