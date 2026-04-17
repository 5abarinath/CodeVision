// ABOUTME: Tests for POST /api/auth/reset-password endpoint.
// ABOUTME: Verifies token validation, password update, token marking, and error cases.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockValidateResetToken = vi.fn();
const mockMarkTokenUsed = vi.fn(async () => {});
const mockUpdateUserPassword = vi.fn(async () => {});

vi.mock('@/lib/repositories/password-resets', () => ({
  validateResetToken: mockValidateResetToken,
  markTokenUsed: mockMarkTokenUsed,
}));

vi.mock('@/lib/repositories/users', () => ({
  updateUserPassword: mockUpdateUserPassword,
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 and updates password on valid token', async () => {
    mockValidateResetToken.mockResolvedValue({ id: 'reset-1', userId: 'user-1' });
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const response = await POST(makeRequest({ token: 'valid-token', password: 'newpassword1' }));
    expect(response.status).toBe(200);
    expect(mockUpdateUserPassword).toHaveBeenCalledWith('user-1', 'newpassword1');
  });

  it('marks the token as used after successful reset', async () => {
    mockValidateResetToken.mockResolvedValue({ id: 'reset-1', userId: 'user-1' });
    const { POST } = await import('@/app/api/auth/reset-password/route');
    await POST(makeRequest({ token: 'valid-token', password: 'newpassword1' }));
    expect(mockMarkTokenUsed).toHaveBeenCalledWith('reset-1');
  });

  it('returns 400 when token is invalid or expired', async () => {
    mockValidateResetToken.mockResolvedValue(null);
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const response = await POST(makeRequest({ token: 'bad-token', password: 'newpassword1' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/invalid or has expired/i);
  });

  it('returns 400 when password is shorter than 8 characters', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const response = await POST(makeRequest({ token: 'some-token', password: 'short' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when token is missing', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const response = await POST(makeRequest({ password: 'newpassword1' }));
    expect(response.status).toBe(400);
  });
});
