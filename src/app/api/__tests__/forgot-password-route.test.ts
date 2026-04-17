// ABOUTME: Tests for POST /api/auth/forgot-password endpoint.
// ABOUTME: Verifies always-200 response, conditional email sending, and validation.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUserByEmail = vi.fn();
const mockCreatePasswordReset = vi.fn(async () => 'raw-token-abc');
const mockSendPasswordResetEmail = vi.fn(async () => {});

vi.mock('@/lib/repositories/users', () => ({
  getUserByEmail: mockGetUserByEmail,
}));

vi.mock('@/lib/repositories/password-resets', () => ({
  createPasswordReset: mockCreatePasswordReset,
}));

vi.mock('@/lib/services/email', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when user exists and is verified', async () => {
    mockGetUserByEmail.mockResolvedValue({ id: 'user-1', email: 'test@example.com', email_verified: true });
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const response = await POST(makeRequest({ email: 'test@example.com' }));
    expect(response.status).toBe(200);
  });

  it('sends reset email when user exists and is verified', async () => {
    mockGetUserByEmail.mockResolvedValue({ id: 'user-1', email: 'test@example.com', email_verified: true });
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    await POST(makeRequest({ email: 'test@example.com' }));
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({ email: 'test@example.com', token: 'raw-token-abc' });
  });

  it('returns 200 even when email is not registered', async () => {
    mockGetUserByEmail.mockResolvedValue(null);
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const response = await POST(makeRequest({ email: 'nobody@example.com' }));
    expect(response.status).toBe(200);
  });

  it('does not send email when user is not found', async () => {
    mockGetUserByEmail.mockResolvedValue(null);
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    await POST(makeRequest({ email: 'nobody@example.com' }));
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('does not send email when user email is not verified', async () => {
    mockGetUserByEmail.mockResolvedValue({ id: 'user-1', email: 'test@example.com', email_verified: false });
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    await POST(makeRequest({ email: 'test@example.com' }));
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid email format', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const response = await POST(makeRequest({ email: 'not-an-email' }));
    expect(response.status).toBe(400);
  });
});
