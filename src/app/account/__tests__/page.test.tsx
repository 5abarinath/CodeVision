// ABOUTME: Tests for the Account page covering tab selection, profile form, and auth redirect.
// ABOUTME: Verifies Profile and Usage tabs render correctly and unauthenticated users are redirected.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/InitialsAvatar', () => ({
  default: () => <div data-testid="avatar" />,
}));

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();

const freeUser = {
  id: 'u1', email: 'test@example.com', first_name: 'Sabari', last_name: 'Sunil', tier: 'free',
};

describe('Account page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: mockReplace, back: mockBack } as ReturnType<typeof useRouter>);
    vi.mocked(useSearchParams).mockReturnValue({ get: () => null } as ReturnType<typeof useSearchParams>);
    vi.mocked(useAuth).mockReturnValue({ user: freeUser, loading: false, logout: vi.fn() } as ReturnType<typeof useAuth>);
  });

  it('shows Profile tab by default', async () => {
    const { default: AccountPage } = await import('@/app/account/page');
    render(<AccountPage />);
    expect(screen.getAllByText('Profile').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('First name')).toBeTruthy();
  });

  it('switches to Usage tab and syncs URL when clicked', async () => {
    const { default: AccountPage } = await import('@/app/account/page');
    render(<AccountPage />);
    fireEvent.click(screen.getByRole('button', { name: /usage/i }));
    expect(screen.getAllByText('Usage').length).toBeGreaterThan(0);
    expect(mockReplace).toHaveBeenCalledWith('/account?tab=usage', { scroll: false });
  });

  it('redirects to /login when not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, logout: vi.fn() } as ReturnType<typeof useAuth>);
    const { default: AccountPage } = await import('@/app/account/page');
    render(<AccountPage />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
  });

  it('shows loading state while auth loads', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true, logout: vi.fn() } as ReturnType<typeof useAuth>);
    const { default: AccountPage } = await import('@/app/account/page');
    render(<AccountPage />);
    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
  });

  it('pre-selects Usage tab from ?tab=usage query param', async () => {
    vi.mocked(useSearchParams).mockReturnValue({ get: (key: string) => key === 'tab' ? 'usage' : null } as ReturnType<typeof useSearchParams>);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total_cost_usd: 0, tier: 'free', tier_limit_usd: 5, events: [] }),
    }) as unknown as typeof fetch;
    const { default: AccountPage } = await import('@/app/account/page');
    render(<AccountPage />);
    expect(screen.getAllByText('Usage').length).toBeGreaterThan(0);
  });

  it('clears success message when editing name after save', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
    const { default: AccountPage } = await import('@/app/account/page');
    render(<AccountPage />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByText(/saved successfully/i)).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'New' } });
    expect(screen.queryByText(/saved successfully/i)).toBeNull();
  });
});
