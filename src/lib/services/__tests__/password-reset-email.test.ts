// ABOUTME: Tests for the sendPasswordResetEmail function in the email service.
// ABOUTME: Verifies the reset link and expiry notice appear in the email HTML.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockSend = vi.fn(async () => ({ data: {}, error: null }));

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockSend },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}));

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_BASE_URL = 'https://app.example.com';
  });

  it('sends an email to the provided address', async () => {
    const { sendPasswordResetEmail } = await import('@/lib/services/email');
    await sendPasswordResetEmail({ email: 'user@test.com', token: 'abc123' });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['user@test.com'] })
    );
  });

  it('includes the reset link with the token in the email body', async () => {
    const { sendPasswordResetEmail } = await import('@/lib/services/email');
    await sendPasswordResetEmail({ email: 'user@test.com', token: 'mytoken' });
    const call = mockSend.mock.calls[0][0] as { html: string };
    expect(call.html).toContain('https://app.example.com/reset-password?token=mytoken');
  });

  it('mentions the 1-hour expiry in the email body', async () => {
    const { sendPasswordResetEmail } = await import('@/lib/services/email');
    await sendPasswordResetEmail({ email: 'user@test.com', token: 'mytoken' });
    const call = mockSend.mock.calls[0][0] as { html: string };
    expect(call.html).toContain('1 hour');
  });
});
