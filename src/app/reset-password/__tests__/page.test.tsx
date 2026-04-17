// ABOUTME: Tests for the /reset-password page component.
// ABOUTME: Covers form validation, success redirect, and error display on invalid tokens.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: (key: string) => key === 'token' ? 'valid-token-abc' : null }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Password updated successfully' }),
    });
  });

  it('renders new password and confirm password inputs', async () => {
    const { default: ResetPasswordPage } = await import('@/app/reset-password/page');
    render(<ResetPasswordPage />);
    expect(screen.getByLabelText(/new password/i)).toBeTruthy();
    expect(screen.getByLabelText(/confirm password/i)).toBeTruthy();
  });

  it('shows validation error when passwords do not match', async () => {
    const { default: ResetPasswordPage } = await import('@/app/reset-password/page');
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    expect(screen.getByText(/passwords do not match/i)).toBeTruthy();
  });

  it('shows validation error when password is shorter than 8 characters', async () => {
    const { default: ResetPasswordPage } = await import('@/app/reset-password/page');
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    expect(screen.getByText(/at least 8 characters/i)).toBeTruthy();
  });

  it('shows success message on valid reset', async () => {
    const { default: ResetPasswordPage } = await import('@/app/reset-password/page');
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByText(/password reset/i)).toBeTruthy();
    });
  });

  it('shows error message when API returns invalid token error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Reset link is invalid or has expired' }),
    });
    const { default: ResetPasswordPage } = await import('@/app/reset-password/page');
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid or has expired/i)).toBeTruthy();
    });
  });

  it('shows a link to /forgot-password on error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Reset link is invalid or has expired' }),
    });
    const { default: ResetPasswordPage } = await import('@/app/reset-password/page');
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /request a new one/i });
      expect(link.getAttribute('href')).toBe('/forgot-password');
    });
  });
});
