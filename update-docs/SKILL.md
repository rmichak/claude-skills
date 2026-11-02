---
name: update-docs
description: Update README.md and CLAUDE.md when application functionality changes. Use when the user says "update docs", "update documentation", "/update-docs", or PROACTIVELY after modifying API routes, components, database schema, or adding/removing features. Also use when the user asks to "read the docs", "what does this app do", or needs context about the current project.
---

# Update Docs

Maintain documentation accuracy by updating README.md and CLAUDE.md when code changes affect functionality.

## When to Trigger

**Automatically after changes to:**
- API routes (`src/app/api/**/*.ts`)
- Page components (`src/app/**/page.tsx`)
- Database schema (`scripts/init-db.js`)
- Key library files (`src/lib/**/*.ts`)
- Package dependencies (`package.json`)

**On explicit request:**
- "update docs", "update documentation", "sync docs"
- "read the docs", "what does this app do"

## Update Workflow

### 1. Detect What Changed

Identify the type of change:

| Change Type | Files Affected | Doc Sections to Update |
|-------------|---------------|------------------------|
| New API route | `src/app/api/**/route.ts` | CLAUDE.md: Key API Routes |
| New page | `src/app/**/page.tsx` | README.md: Features |
| DB schema | `scripts/init-db.js` | CLAUDE.md: Database Location |
| New command | `package.json` scripts | CLAUDE.md: Commands |
| New dependency | `package.json` | CLAUDE.md: Stack |

### 2. Update README.md

README.md is user-facing documentation. Update these sections:

- **Features**: Add/remove feature descriptions
- **Getting Started**: Update setup steps if changed
- **Usage**: Update workflow descriptions

Keep language accessible to end users. Focus on what the app does, not implementation details.

### 3. Update CLAUDE.md

CLAUDE.md is AI guidance documentation. Update these sections:

- **Commands**: Add new npm scripts
- **Architecture > Stack**: Update if dependencies change significantly
- **Architecture > Key Data Flow**: Update if workflow changes
- **Key API Routes**: Add/remove route descriptions
- **Important Patterns**: Document new patterns introduced
- **Directory Structure**: Update if new directories added

Keep technical and concise. This guides AI assistants working on the code.

### 4. Verify Updates

After updating documentation:
1. Read both files to confirm accuracy
2. Ensure no stale information remains
3. Check that new features are documented

## Reading Documentation

When user asks about the app or needs context:

### Quick Summary
Provide: app purpose, tech stack, key commands (`npm run dev`, `npm run build`, `npm run db:init`)

### Context-Aware Reading
Based on current work:
- Working on API? Read CLAUDE.md "Key API Routes" section
- Working on UI? Read README.md features + CLAUDE.md components
- Database work? Read CLAUDE.md "Database Location" and schema info
- New to project? Read both files' overview sections

### Full Documentation
When requested, read and summarize both README.md and CLAUDE.md completely.

## Documentation Standards

**README.md style:**
- User-friendly language
- Focus on features and usage
- Include screenshots/examples where helpful

**CLAUDE.md style:**
- Technical and concise
- Code patterns and file paths
- Architecture decisions
