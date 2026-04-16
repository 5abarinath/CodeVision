// ABOUTME: Vitest tests for the GET /api/auth/me endpoint.
// ABOUTME: Verifies authenticated users receive all profile fields and unauthenticated requests return null.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: vi.fn(async () => ({
    id: 'user-1',
    email: 'test@northwestern.edu',
    first_name: 'Test',
    last_name: 'User',
    tier: 'free',
    password_hash: 'hash',
    email_verified: true,
    created_at: new Date().toISOString(),
  })),
}));

describe('GET /api/auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all profile fields for authenticated user', async () => {
    const { GET } = await import('@/app/api/auth/me/route');
    const response = await GET(new NextRequest('http://localhost/api/auth/me'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe('user-1');
    expect(body.user.email).toBe('test@northwestern.edu');
    expect(body.user.first_name).toBe('Test');
    expect(body.user.last_name).toBe('User');
    expect(body.user.tier).toBe('free');
    expect(body.user.password_hash).toBeUndefined();
  });

  it('returns user null when unauthenticated', async () => {
    const { getUserFromRequest } = await import('@/lib/auth');
    vi.mocked(getUserFromRequest).mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/auth/me/route');
    const response = await GET(new NextRequest('http://localhost/api/auth/me'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toBeNull();
  });
});
