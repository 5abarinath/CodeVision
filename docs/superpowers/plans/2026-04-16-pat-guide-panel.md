# PAT Guide Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible "How do I create a personal access token?" guide panel inside the GitHub connection step, shown only for private repos.

**Architecture:** Single file modification to `GitHubConnectionStep.tsx` — add a `showPatGuide` boolean state, a clickable trigger row below the token input, and an animated expandable panel with numbered steps and a link to GitHub docs.

**Tech Stack:** React (useState), TypeScript, Tailwind CSS, Vitest + React Testing Library

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/wizard/GitHubConnectionStep.tsx` | Modify | Add `showPatGuide` state + PAT guide panel UI |
| `src/components/__tests__/GitHubConnectionStep.test.tsx` | Create | Unit tests for panel visibility, toggle, and link |

---

## Task 1: Write the failing tests

**Files:**
- Create: `src/components/__tests__/GitHubConnectionStep.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// ABOUTME: Tests for GitHubConnectionStep focusing on PAT guide panel behavior.
// ABOUTME: Verifies panel visibility, toggle behavior, and docs link presence.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GitHubConnectionStep from '@/components/wizard/GitHubConnectionStep';
import { useWizard } from '@/contexts/WizardContext';

vi.mock('@/contexts/WizardContext', () => ({
  useWizard: vi.fn(),
}));

const mockWizard = (overrides = {}) => ({
  data: {
    name: 'Test',
    description: '',
    is_public: false,
    github_url: '',
    github_token: '',
    github_validated: false,
    documents: [],
    readme_imported: false,
    ...overrides,
  },
  updateData: vi.fn(),
  nextStep: vi.fn(),
  previousStep: vi.fn(),
  currentStep: 2,
  resetWizard: vi.fn(),
});

describe('GitHubConnectionStep — PAT guide panel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not render the PAT guide trigger when repo is public', () => {
    (useWizard as ReturnType<typeof vi.fn>).mockReturnValue(
      mockWizard({ is_public: true })
    );
    render(<GitHubConnectionStep />);
    expect(screen.queryByText(/how do i create a personal access token/i)).toBeNull();
  });

  it('renders the PAT guide trigger when repo is private', () => {
    (useWizard as ReturnType<typeof vi.fn>).mockReturnValue(mockWizard());
    render(<GitHubConnectionStep />);
    expect(screen.getByText(/how do i create a personal access token/i)).toBeTruthy();
  });

  it('panel content is hidden by default', () => {
    (useWizard as ReturnType<typeof vi.fn>).mockReturnValue(mockWizard());
    render(<GitHubConnectionStep />);
    expect(screen.queryByText(/go to github\.com/i)).toBeNull();
  });

  it('clicking the trigger reveals the numbered steps', () => {
    (useWizard as ReturnType<typeof vi.fn>).mockReturnValue(mockWizard());
    render(<GitHubConnectionStep />);
    fireEvent.click(screen.getByText(/how do i create a personal access token/i));
    expect(screen.getByText(/go to github\.com/i)).toBeTruthy();
    expect(screen.getByText(/developer settings/i)).toBeTruthy();
    expect(screen.getByText(/tokens \(classic\)/i)).toBeTruthy();
    expect(screen.getByText(/generate new token \(classic\)/i)).toBeTruthy();
    expect(screen.getByText(/repo.*scope/i)).toBeTruthy();
  });

  it('clicking the trigger again hides the panel', () => {
    (useWizard as ReturnType<typeof vi.fn>).mockReturnValue(mockWizard());
    render(<GitHubConnectionStep />);
    const trigger = screen.getByText(/how do i create a personal access token/i);
    fireEvent.click(trigger);
    expect(screen.getByText(/go to github\.com/i)).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByText(/go to github\.com/i)).toBeNull();
  });

  it('shows a link to the GitHub docs when panel is open', () => {
    (useWizard as ReturnType<typeof vi.fn>).mockReturnValue(mockWizard());
    render(<GitHubConnectionStep />);
    fireEvent.click(screen.getByText(/how do i create a personal access token/i));
    const link = screen.getByRole('link', { name: /full guide on github docs/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe(
      'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens'
    );
    expect(link.getAttribute('target')).toBe('_blank');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/components/__tests__/GitHubConnectionStep.test.tsx
```

Expected: All 6 tests FAIL (component doesn't have the panel yet)

---

## Task 2: Implement the PAT guide panel

**Files:**
- Modify: `src/components/wizard/GitHubConnectionStep.tsx`

- [ ] **Step 3: Add `showPatGuide` state and replace the existing hint text + add the panel**

Replace the existing `useState` imports and add the new state. Then replace the token field section (the `!data.is_public` block) with the updated version below.

Find this block in `GitHubConnectionStep.tsx` (around line 132):

```tsx
        {!data.is_public && (
          <div className="mb-6">
            <label
              htmlFor="github_token"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              GitHub Personal Access Token *
            </label>
            <input
              type="password"
              id="github_token"
              className="input-dark w-full px-4 py-3 rounded-lg"
              value={data.github_token}
              onChange={e => {
                updateData({ github_token: e.target.value, github_validated: false });
                setValidationSuccess(false);
              }}
            />
            <p className="mt-2 text-xs text-gray-500">
              Create a token at GitHub Settings → Developer Settings → Personal Access Tokens.
              Needs repo read access.
            </p>
          </div>
        )}
```

Replace it with:

```tsx
        {!data.is_public && (
          <div className="mb-6">
            <label
              htmlFor="github_token"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              GitHub Personal Access Token *
            </label>
            <input
              type="password"
              id="github_token"
              className="input-dark w-full px-4 py-3 rounded-lg"
              value={data.github_token}
              onChange={e => {
                updateData({ github_token: e.target.value, github_validated: false });
                setValidationSuccess(false);
              }}
            />
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowPatGuide(prev => !prev)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                <span className="flex items-center justify-center w-4 h-4 rounded-full border border-gray-500 text-xs">?</span>
                <span>How do I create a personal access token?</span>
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${showPatGuide ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPatGuide && (
                <div className="mt-2 p-4 bg-gray-800/40 rounded-lg">
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
                    <li>Go to GitHub.com → click your profile photo → <span className="text-gray-300">Settings</span></li>
                    <li>Scroll to <span className="text-gray-300">Developer settings</span> (bottom of left sidebar)</li>
                    <li>Select <span className="text-gray-300">Personal access tokens → Tokens (classic)</span></li>
                    <li>Click <span className="text-gray-300">Generate new token (classic)</span></li>
                    <li>Select the <span className="text-gray-300">repo</span> scope → click <span className="text-gray-300">Generate token</span> → copy it</li>
                  </ol>
                  <a
                    href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Full guide on GitHub docs ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
```

Also add `showPatGuide` state at the top of the component (after the existing `useState` declarations):

```tsx
  const [showPatGuide, setShowPatGuide] = useState(false);
```

And add a reset for `showPatGuide` in the existing `useEffect` that resets on `is_public`/`github_url` changes:

```tsx
  useEffect(() => {
    setValidationSuccess(false);
    setError('');
    setShowPatGuide(false);
  }, [data.is_public, data.github_url]);
```

- [ ] **Step 4: Run the tests to confirm they all pass**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/components/__tests__/GitHubConnectionStep.test.tsx
```

Expected: All 6 tests PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd /home/sabari/dev/code-vision && npx vitest run
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /home/sabari/dev/code-vision && git add src/components/wizard/GitHubConnectionStep.tsx src/components/__tests__/GitHubConnectionStep.test.tsx && git commit -m "feat: add expandable PAT guide panel to GitHub connection step"
```
