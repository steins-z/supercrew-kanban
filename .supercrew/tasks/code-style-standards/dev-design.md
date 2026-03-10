---
status: draft
reviewers: []
---

# Code Style and Formatting Standards — Technical Design

## Design Decisions

### Tooling Choice: Prettier + ESLint

**Decision**: Use Prettier for formatting and ESLint for code quality.

**Rationale**:
- Prettier handles all formatting automatically (quotes, semicolons, indentation, line breaks)
- ESLint focuses on code quality and catches potential bugs
- Both tools are industry standard and well-supported in the ecosystem
- Works seamlessly with VSCode and other IDEs

### Configuration Strategy

**Decision**: Create shared configs in root + override in packages as needed.

**Rationale**:
- Monorepo structure requires consistent rules across packages
- Root config ensures consistency
- Package-level overrides allow flexibility where needed (e.g., frontend vs backend)

### Pre-commit Hook Strategy

**Decision**: Use `husky` + `lint-staged` for automatic formatting on commit.

**Rationale**:
- Automatic enforcement prevents format conflicts
- Only formats staged files (fast)
- Developers can't accidentally commit incorrectly formatted code

## Architecture

### File Structure

```
root/
├── .prettierrc.json          # Prettier config
├── .prettierignore           # Files to ignore
├── .eslintrc.json            # ESLint config (shared)
├── .eslintignore             # Files to ignore
├── .husky/                   # Git hooks
│   └── pre-commit            # Run lint-staged on commit
├── .vscode/
│   └── settings.json         # VSCode auto-format on save
├── backend/
│   └── .eslintrc.json        # Backend-specific overrides
└── frontend/
    └── .eslintrc.json        # Frontend-specific overrides
```

### Prettier Configuration

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

**Key decisions**:
- `singleQuote: true` - 解决单双引号冲突
- `semi: false` - 无分号风格 (符合现代 JS 趋势)
- `trailingComma: "all"` - 方便 git diff
- `endOfLine: "lf"` - 统一换行符 (Unix style)

### ESLint Configuration

Base config focuses on:
- TypeScript support (`@typescript-eslint/parser`)
- Import sorting (`eslint-plugin-import`)
- React rules for frontend (`eslint-plugin-react`)

### VSCode Settings

Auto-format on save:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Implementation Notes

### Installation Order

1. Install Prettier and ESLint packages
2. Create configuration files
3. Set up pre-commit hooks (husky + lint-staged)
4. Update VSCode settings
5. Run format on entire codebase once
6. Commit formatted code

### Package Dependencies

**Root `package.json` (devDependencies)**:
- `prettier`
- `eslint`
- `@typescript-eslint/parser`
- `@typescript-eslint/eslint-plugin`
- `husky`
- `lint-staged`

**Frontend additional**:
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`

### Lint-Staged Configuration

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,css}": [
      "prettier --write"
    ]
  }
}
```

### Edge Cases

1. **Generated files**: Add to `.prettierignore` (e.g., `routeTree.gen.ts`)
2. **Build output**: Ignore `dist/`, `build/`, `.next/`
3. **Dependencies**: Ignore `node_modules/`
4. **Existing formatted code**: One-time bulk format may create large diffs

### Migration Strategy

1. Install tools without enforcement first
2. Format one directory at a time to review changes
3. Enable pre-commit hook after team approves formatting style
4. Update CLAUDE.md with formatting guidelines
