// ABOUTME: Vitest tests for the POST /api/auth/signup endpoint covering name field validation.
// ABOUTME: Verifies first_name is required, last_name is optional, and both fields are accepted correctly.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/repositories/users', () => ({
  getUserByEmail: vi.fn(async () => null),
  createUser: vi.fn(async (input: { email: string; first_name: string; last_name?: string }) => ({
    id: 'user-1',
    email: input.email,
    first_name: input.first_name,
    last_name: input.last_name ?? null,
    email_verified: false,
    tier: 'free',
    created_at: new Date().toISOString(),
  })),
}));

vi.mock('@/lib/repositories/email-verifications', () => ({
  createEmailVerification: vi.fn(async () => ({ code: '123456', expiresInMinutes: 15 })),
}));

vi.mock('@/lib/services/email', () => ({
  sendOTPEmail: vi.fn(async () => {}),
}));

vi.mock('@/lib/auth', () => ({
  isAllowedEmail: vi.fn(() => true),
}));

describe('POST /api/auth/signup name fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 when first_name and last_name provided', async () => {
    const { POST } = await import('@/app/api/auth/signup/route');
    const request = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@northwestern.edu', password: 'password123', first_name: 'Test', last_name: 'User' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('returns 400 when first_name is missing', async () => {
    const { POST } = await import('@/app/api/auth/signup/route');
    const request = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@northwestern.edu', password: 'password123', first_name: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('First name');
  });

  it('returns 201 when last_name is omitted', async () => {
    const { POST } = await import('@/app/api/auth/signup/route');
    const request = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@northwestern.edu', password: 'password123', first_name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
  });
});
