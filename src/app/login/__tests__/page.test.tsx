// ABOUTME: Tests for the login page, specifically the "Forgot password?" link.
// ABOUTME: Verifies the link is present and points to /forgot-password with correct styling.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

describe('LoginPage', () => {
  it('renders a "Forgot password?" link pointing to /forgot-password', async () => {
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    const link = screen.getByRole('link', { name: /forgot password/i });
    expect(link.getAttribute('href')).toBe('/forgot-password');
  });

  it('forgot password link has correct styling classes', async () => {
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    const link = screen.getByRole('link', { name: /forgot password/i });
    const className = link.getAttribute('class');
    expect(className).toContain('text-sm');
    expect(className).toContain('text-purple-400');
    expect(className).toContain('hover:text-purple-300');
  });
});
