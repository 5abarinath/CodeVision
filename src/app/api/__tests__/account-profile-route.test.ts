// ABOUTME: Vitest tests for the PUT /api/account/profile endpoint.
// ABOUTME: Verifies name update, validation of required first_name, and auth enforcement.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: vi.fn(async () => ({
    id: 'user-1', email: 'test@northwestern.edu', first_name: 'Old', last_name: 'Name', tier: 'free',
  })),
}));

vi.mock('@/lib/db', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: 'user-1', email: 'test@northwestern.edu', first_name: 'New', last_name: 'Name', tier: 'free' },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('PUT /api/account/profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 and updated user when valid names provided', async () => {
    const { PUT } = await import('@/app/api/account/profile/route');
    const req = new NextRequest('http://localhost/api/account/profile', {
      method: 'PUT',
      body: JSON.stringify({ first_name: 'New', last_name: 'Name' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.first_name).toBe('New');
  });

  it('returns 400 when first_name is empty', async () => {
    const { PUT } = await import('@/app/api/account/profile/route');
    const req = new NextRequest('http://localhost/api/account/profile', {
      method: 'PUT',
      body: JSON.stringify({ first_name: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(req);
    expect(response.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const { getUserFromRequest } = await import('@/lib/auth');
    vi.mocked(getUserFromRequest).mockResolvedValueOnce(null);
    const { PUT } = await import('@/app/api/account/profile/route');
    const req = new NextRequest('http://localhost/api/account/profile', {
      method: 'PUT',
      body: JSON.stringify({ first_name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(req);
    expect(response.status).toBe(401);
  });
});
