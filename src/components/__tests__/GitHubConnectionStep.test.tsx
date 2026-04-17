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
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
