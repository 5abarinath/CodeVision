# PAT Guide Panel — Design Spec

**Date:** 2026-04-16
**Feature:** Expandable GitHub Personal Access Token guide in project creation wizard

---

## Overview

When users create a new project and select a private GitHub repository, they must provide a Personal Access Token (PAT). Currently the UI shows only a minimal hint about where to find the setting. This feature adds an expandable help panel directly below the token input field that walks users through creating a PAT in a simple numbered list, with a link to GitHub's official docs.

---

## Scope

- **File modified:** `src/components/wizard/GitHubConnectionStep.tsx`
- **No new files or components** — logic lives inline in the existing step component
- **Only visible when `!data.is_public`** — panel is not rendered for public repos

---

## UI Design

### Trigger Row

- Positioned directly below the token `<input>` field (replaces existing small hint text)
- Contains: help icon ("?"), label "How do I create a personal access token?", rotating chevron
- Styling: `text-gray-400 hover:text-gray-300 cursor-pointer`, secondary/understated feel
- Chevron rotates 180° when panel is open (CSS `transform rotate-180`)

### Expanded Panel Content

Container: `bg-gray-800/40 rounded-lg p-4 mt-2`

**Numbered steps (one line each):**
1. Go to GitHub.com → click your profile photo → **Settings**
2. Scroll to **Developer settings** (bottom of left sidebar)
3. Select **Personal access tokens → Tokens (classic)**
4. Click **Generate new token (classic)**
5. Select the `repo` scope → click **Generate token** → copy it

**Docs link** (below the list):
- Text: "Full guide on GitHub docs ↗"
- URL: `https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens`
- Styling: purple-tinted (`text-purple-400 hover:text-purple-300`), opens in new tab

---

## State

```tsx
const [showPatGuide, setShowPatGuide] = useState(false);
```

Single local boolean. Toggled by clicking the trigger row.

---

## Behavior

- Panel resets to closed when `data.is_public` toggles (via the existing `useEffect` that resets validation state — or a separate effect)
- No changes to wizard navigation, validation logic, or API calls

---

## What Does Not Change

- GitHub URL input field
- Validate Access button
- Back / Next navigation
- Any API routes or services

