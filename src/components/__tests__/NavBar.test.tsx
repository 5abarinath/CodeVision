// ABOUTME: Tests for NavBar component covering authenticated, unauthenticated, and loading states.
// ABOUTME: Verifies dropdown behavior, tier badge rendering, and navigation links.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NavBar from '@/components/NavBar';
import { useAuth } from '@/lib/hooks/useAuth';

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/InitialsAvatar', () => ({
  default: () => <div data-testid="initials-avatar" />,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, className }: { href: string; children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <a href={href} onClick={onClick} className={className}>{children}</a>
  ),
}));

vi.mock('@/components/Logo', () => ({
  LogoFull: () => <div data-testid="logo-full" />,
}));

const mockLogout = vi.fn();
const freeUser = { id: 'u1', email: 'test@example.com', first_name: 'Sabari', last_name: 'Sunil', tier: 'free' };
const proUser = { ...freeUser, tier: 'pro' };

describe('NavBar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading indicator when auth is loading', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, loading: true, logout: mockLogout });
    render(<NavBar />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows Login and Sign Up links when not authenticated', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, loading: false, logout: mockLogout });
    render(<NavBar />);
    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  it('shows avatar and first name when authenticated', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: freeUser, loading: false, logout: mockLogout });
    render(<NavBar />);
    expect(screen.getByTestId('initials-avatar')).toBeTruthy();
    expect(screen.getByText('Sabari')).toBeTruthy();
  });

  it('shows dropdown with Free badge when avatar is clicked', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: freeUser, loading: false, logout: mockLogout });
    render(<NavBar />);
    const avatarButton = screen.getByRole('button', { name: /sabari/i });
    fireEvent.click(avatarButton);
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Usage')).toBeTruthy();
    expect(screen.getByText('Logout')).toBeTruthy();
  });

  it('shows Pro badge for pro tier user', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: proUser, loading: false, logout: mockLogout });
    render(<NavBar />);
    const avatarButton = screen.getByRole('button', { name: /sabari/i });
    fireEvent.click(avatarButton);
    expect(screen.getByText('Pro')).toBeTruthy();
  });

  it('closes dropdown when clicking outside', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: freeUser, loading: false, logout: mockLogout });
    render(<NavBar />);
    const avatarButton = screen.getByRole('button', { name: /sabari/i });
    fireEvent.click(avatarButton);
    expect(screen.getByText('Profile')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Profile')).toBeNull();
  });
});
