// ABOUTME: Tests for the /forgot-password page component.
// ABOUTME: Verifies form rendering, submit behavior, and success message display.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "If that email is registered, you'll receive a reset link shortly" }),
    });
  });

  it('renders the email input and submit button', async () => {
    const { default: ForgotPasswordPage } = await import('@/app/forgot-password/page');
    render(<ForgotPasswordPage />);
    expect(screen.getByRole('textbox', { name: /email/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeTruthy();
  });

  it('renders a link back to login', async () => {
    const { default: ForgotPasswordPage } = await import('@/app/forgot-password/page');
    render(<ForgotPasswordPage />);
    const link = screen.getByRole('link', { name: /back to login/i });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('shows success message after form submit', async () => {
    const { default: ForgotPasswordPage } = await import('@/app/forgot-password/page');
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    await waitFor(() => {
      expect(screen.getByText(/if that email is registered/i)).toBeTruthy();
    });
  });

  it('shows success message even when API returns an error response', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Server error' }) });
    const { default: ForgotPasswordPage } = await import('@/app/forgot-password/page');
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    await waitFor(() => {
      expect(screen.getByText(/if that email is registered/i)).toBeTruthy();
    });
  });
});
