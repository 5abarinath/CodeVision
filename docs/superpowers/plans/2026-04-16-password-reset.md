# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a link-based password reset flow: user requests reset via email, receives a 1-hour one-time link, sets a new password.

**Architecture:** New `password_resets` DB table stores SHA-256 hashed tokens. Two new API routes handle request and redemption. Two new pages provide the UI. The existing email service and users repository are extended. No existing sessions are invalidated.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (PostgreSQL), bcryptjs, Node.js crypto, Resend (email), Zod (validation), Vitest + React Testing Library

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `migrations/014_add_password_resets.sql` | Create | DB table for reset tokens |
| `src/lib/db.ts` | Modify | Add `PasswordReset` TypeScript interface |
| `src/lib/repositories/password-resets.ts` | Create | Token creation, validation, mark-used |
| `src/lib/repositories/users.ts` | Modify | Add `updateUserPassword` |
| `src/lib/services/email.ts` | Modify | Add `sendPasswordResetEmail` |
| `src/app/api/auth/forgot-password/route.ts` | Create | POST handler: generate token, send email |
| `src/app/api/auth/reset-password/route.ts` | Create | POST handler: validate token, update password |
| `src/app/forgot-password/page.tsx` | Create | Email entry form |
| `src/app/reset-password/page.tsx` | Create | New password form |
| `src/app/login/page.tsx` | Modify | Add "Forgot password?" link |
| `src/lib/repositories/__tests__/password-resets.test.ts` | Create | Repository unit tests |
| `src/app/api/__tests__/forgot-password-route.test.ts` | Create | API route tests |
| `src/app/api/__tests__/reset-password-route.test.ts` | Create | API route tests |
| `src/app/forgot-password/__tests__/page.test.tsx` | Create | Page component tests |
| `src/app/reset-password/__tests__/page.test.tsx` | Create | Page component tests |
| `src/app/login/__tests__/page.test.tsx` | Create | Login page test for new link |

---

## Task 1: DB Migration + TypeScript Type

**Files:**
- Create: `migrations/014_add_password_resets.sql`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/014_add_password_resets.sql
CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);
```

- [ ] **Step 2: Run the migration**

```bash
cd /home/sabari/dev/code-vision && npx supabase db push
```

If `supabase` CLI is not available, run the SQL directly via the Supabase dashboard or:
```bash
psql "$DATABASE_URL" -f migrations/014_add_password_resets.sql
```

- [ ] **Step 3: Add the PasswordReset interface to `src/lib/db.ts`**

After the `EmailVerification` interface (around line 40), add:

```typescript
export interface PasswordReset {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add migrations/014_add_password_resets.sql src/lib/db.ts
git commit -m "feat: add password_resets table and PasswordReset type"
```

---

## Task 2: Password Resets Repository

**Files:**
- Create: `src/lib/repositories/password-resets.ts`
- Create: `src/lib/repositories/__tests__/password-resets.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/repositories/__tests__/password-resets.test.ts
// ABOUTME: Unit tests for the password-resets repository.
// ABOUTME: Verifies token creation, validation, and mark-used behavior with mocked Supabase.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockGt = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/db', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
    })),
  },
}));

// Chain helpers — reset before each test
function makeChain(finalValue: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.gt = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(finalValue));
  return chain;
}

import { supabase } from '@/lib/db';

describe('password-resets repository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createPasswordReset', () => {
    it('returns a 64-character hex token', async () => {
      const chain = makeChain({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const { createPasswordReset } = await import('@/lib/repositories/password-resets');
      const token = await createPasswordReset('user-1');
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('does not store the raw token (stores a hash instead)', async () => {
      let storedData: Record<string, unknown> | null = null;
      const chain = makeChain({ data: null, error: null });
      (chain.insert as ReturnType<typeof vi.fn>).mockImplementation((data: Record<string, unknown>) => {
        storedData = data;
        return chain;
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const { createPasswordReset } = await import('@/lib/repositories/password-resets');
      const token = await createPasswordReset('user-1');

      expect(storedData).not.toBeNull();
      expect((storedData as Record<string, unknown>).token_hash).not.toBe(token);
      expect((storedData as Record<string, unknown>).token_hash).toHaveLength(64);
    });
  });

  describe('validateResetToken', () => {
    it('returns null when token is not found', async () => {
      const chain = makeChain({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const { validateResetToken } = await import('@/lib/repositories/password-resets');
      const result = await validateResetToken('nonexistent-token');
      expect(result).toBeNull();
    });

    it('returns id and userId when token is valid', async () => {
      const chain = makeChain({
        data: { id: 'reset-1', user_id: 'user-1' },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const { validateResetToken } = await import('@/lib/repositories/password-resets');
      const result = await validateResetToken('a'.repeat(64));
      expect(result).toEqual({ id: 'reset-1', userId: 'user-1' });
    });
  });

  describe('markTokenUsed', () => {
    it('calls update with used_at set', async () => {
      const chain = makeChain({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const { markTokenUsed } = await import('@/lib/repositories/password-resets');
      await markTokenUsed('reset-1');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ used_at: expect.any(String) })
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/lib/repositories/__tests__/password-resets.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the repository**

```typescript
// src/lib/repositories/password-resets.ts
// ABOUTME: Repository for managing password reset tokens.
// ABOUTME: Handles secure token generation, hashing, validation, and one-time-use marking.
import { supabase } from '../db';
import type { PasswordReset } from '../db';
import crypto from 'crypto';

const TOKEN_EXPIRY_HOURS = 1;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createPasswordReset(userId: string): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  const { error } = await supabase
    .from('password_resets')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error('Error creating password reset:', error);
    throw new Error('Failed to create password reset');
  }

  return token;
}

export async function validateResetToken(
  rawToken: string
): Promise<{ id: string; userId: string } | null> {
  const tokenHash = hashToken(rawToken);

  const { data, error } = await supabase
    .from('password_resets')
    .select('id, user_id')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  const reset = data as Pick<PasswordReset, 'id' | 'user_id'>;
  return { id: reset.id, userId: reset.user_id };
}

export async function markTokenUsed(id: string): Promise<void> {
  await supabase
    .from('password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/lib/repositories/__tests__/password-resets.test.ts 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/password-resets.ts src/lib/repositories/__tests__/password-resets.test.ts
git commit -m "feat: add password-resets repository with token generation and validation"
```

---

## Task 3: updateUserPassword in Users Repository

**Files:**
- Modify: `src/lib/repositories/users.ts`

- [ ] **Step 1: Write the failing test**

Add a new test file:

```typescript
// src/lib/repositories/__tests__/users-password.test.ts
// ABOUTME: Tests for the updateUserPassword function in the users repository.
// ABOUTME: Verifies bcrypt hashing and Supabase update are called correctly.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async () => 'hashed-password'),
    compare: vi.fn(async () => true),
  },
}));

const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/db', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockUpdate,
    })),
  },
}));

import { supabase } from '@/lib/db';

describe('updateUserPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = { update: mockUpdate, eq: mockEq };
    mockUpdate.mockReturnValue(chain);
    mockEq.mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);
  });

  it('hashes the password before storing', async () => {
    const bcrypt = await import('bcryptjs');
    const { updateUserPassword } = await import('@/lib/repositories/users');
    await updateUserPassword('user-1', 'newpassword123');
    expect(bcrypt.default.hash).toHaveBeenCalledWith('newpassword123', 10);
  });

  it('calls supabase update with the hashed password', async () => {
    const { updateUserPassword } = await import('@/lib/repositories/users');
    await updateUserPassword('user-1', 'newpassword123');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ password_hash: 'hashed-password' })
    );
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/lib/repositories/__tests__/users-password.test.ts 2>&1 | tail -15
```

Expected: FAIL — `updateUserPassword` is not exported

- [ ] **Step 3: Add `updateUserPassword` to `src/lib/repositories/users.ts`**

Append to the end of the file:

```typescript
export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const password_hash = await bcrypt.hash(newPassword, 10);

  const { error } = await supabase
    .from('users')
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('Error updating password:', error);
    throw new Error('Failed to update password');
  }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/lib/repositories/__tests__/users-password.test.ts 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/users.ts src/lib/repositories/__tests__/users-password.test.ts
git commit -m "feat: add updateUserPassword to users repository"
```

---

## Task 4: sendPasswordResetEmail in Email Service

**Files:**
- Modify: `src/lib/services/email.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/__tests__/password-reset-email.test.ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/lib/services/__tests__/password-reset-email.test.ts 2>&1 | tail -15
```

Expected: FAIL — `sendPasswordResetEmail` not exported

- [ ] **Step 3: Add `sendPasswordResetEmail` to `src/lib/services/email.ts`**

Add this interface and function at the end of the file:

```typescript
interface PasswordResetData {
  email: string;
  token: string;
}

export async function sendPasswordResetEmail(data: PasswordResetData) {
  const resend = getResendClient();
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${data.token}`;

  const { error } = await resend.emails.send({
    from: 'Code Vision <onboarding@codevision.app>',
    to: [data.email],
    subject: 'Reset your Code Vision password',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Reset Your Password</h1>
        </div>

        <div style="border: 1px solid #E5E7EB; border-top: none; padding: 40px; border-radius: 0 0 12px 12px; background: white;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            We received a request to reset your Code Vision password. Click the button below to choose a new password.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Reset Password
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280; margin-top: 20px;">
            This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #9CA3AF; font-size: 12px;">
          <p>Code Vision - Chrome DevTools for Understanding Code</p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }

  return { success: true };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/lib/services/__tests__/password-reset-email.test.ts 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/email.ts src/lib/services/__tests__/password-reset-email.test.ts
git commit -m "feat: add sendPasswordResetEmail to email service"
```

---

## Task 5: POST /api/auth/forgot-password Route

**Files:**
- Create: `src/app/api/auth/forgot-password/route.ts`
- Create: `src/app/api/__tests__/forgot-password-route.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/__tests__/forgot-password-route.test.ts
// ABOUTME: Tests for POST /api/auth/forgot-password endpoint.
// ABOUTME: Verifies always-200 response, conditional email sending, and email-not-found handling.
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/app/api/__tests__/forgot-password-route.test.ts 2>&1 | tail -15
```

Expected: FAIL — route not found

- [ ] **Step 3: Create the route**

```typescript
// src/app/api/auth/forgot-password/route.ts
// ABOUTME: API route for initiating the password reset flow.
// ABOUTME: Always returns 200 to avoid leaking whether an email is registered.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmail } from '@/lib/repositories/users';
import { createPasswordReset } from '@/lib/repositories/password-resets';
import { sendPasswordResetEmail } from '@/lib/services/email';

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

const SUCCESS_MESSAGE = "If that email is registered, you'll receive a reset link shortly";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ForgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    try {
      const user = await getUserByEmail(email);
      if (user && user.email_verified) {
        const token = await createPasswordReset(user.id);
        await sendPasswordResetEmail({ email: user.email, token });
      }
    } catch (err) {
      console.error('Password reset error (internal):', err);
    }

    return NextResponse.json({ message: SUCCESS_MESSAGE });
  } catch (error) {
    console.error('Forgot password route error:', error);
    return NextResponse.json({ message: SUCCESS_MESSAGE });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/app/api/__tests__/forgot-password-route.test.ts 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/forgot-password/route.ts src/app/api/__tests__/forgot-password-route.test.ts
git commit -m "feat: add POST /api/auth/forgot-password route"
```

---

## Task 6: POST /api/auth/reset-password Route

**Files:**
- Create: `src/app/api/auth/reset-password/route.ts`
- Create: `src/app/api/__tests__/reset-password-route.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/__tests__/reset-password-route.test.ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/app/api/__tests__/reset-password-route.test.ts 2>&1 | tail -15
```

Expected: FAIL — route not found

- [ ] **Step 3: Create the route**

```typescript
// src/app/api/auth/reset-password/route.ts
// ABOUTME: API route for completing a password reset using a one-time token.
// ABOUTME: Validates the token, updates the password, and marks the token as used.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateResetToken, markTokenUsed } from '@/lib/repositories/password-resets';
import { updateUserPassword } from '@/lib/repositories/users';

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    const resetRecord = await validateResetToken(token);
    if (!resetRecord) {
      return NextResponse.json(
        { error: 'Reset link is invalid or has expired' },
        { status: 400 }
      );
    }

    await updateUserPassword(resetRecord.userId, password);
    await markTokenUsed(resetRecord.id);

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/app/api/__tests__/reset-password-route.test.ts 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/reset-password/route.ts src/app/api/__tests__/reset-password-route.test.ts
git commit -m "feat: add POST /api/auth/reset-password route"
```

---

## Task 7: /forgot-password Page

**Files:**
- Create: `src/app/forgot-password/page.tsx`
- Create: `src/app/forgot-password/__tests__/page.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/forgot-password/__tests__/page.test.tsx
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/app/forgot-password/__tests__/page.test.tsx 2>&1 | tail -15
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the page**

```tsx
// src/app/forgot-password/page.tsx
// ABOUTME: Page for requesting a password reset email.
// ABOUTME: Always shows a success message after submit to avoid leaking email existence.
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Intentionally swallow errors — always show success message
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          Reset Password
        </h1>
        <p className="text-gray-400 text-sm text-center mb-6">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {submitted ? (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm text-center">
            If that email is registered, you&apos;ll receive a reset link shortly.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-dark w-full rounded-lg px-4 py-2 text-white"
                placeholder="your.email@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 rounded-lg text-white font-medium"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-gray-400">
          <Link href="/login" className="text-purple-400 hover:text-purple-300">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/app/forgot-password/__tests__/page.test.tsx 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/forgot-password/page.tsx src/app/forgot-password/__tests__/page.test.tsx
git commit -m "feat: add /forgot-password page"
```

---

## Task 8: /reset-password Page

**Files:**
- Create: `src/app/reset-password/page.tsx`
- Create: `src/app/reset-password/__tests__/page.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/reset-password/__tests__/page.test.tsx
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/app/reset-password/__tests__/page.test.tsx 2>&1 | tail -15
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the page**

```tsx
// src/app/reset-password/page.tsx
// ABOUTME: Page for completing a password reset using a token from an email link.
// ABOUTME: Validates matching passwords, submits to API, then redirects to login on success.
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Set New Password
        </h1>

        {success ? (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm text-center">
            Password reset! Redirecting to login...
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
                {/invalid or has expired/i.test(error) && (
                  <span>
                    {' '}
                    <Link href="/forgot-password" className="underline hover:text-red-300">
                      Request a new one
                    </Link>
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-dark w-full rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-1">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="input-dark w-full rounded-lg px-4 py-2 text-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 rounded-lg text-white font-medium"
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/app/reset-password/__tests__/page.test.tsx 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/reset-password/page.tsx src/app/reset-password/__tests__/page.test.tsx
git commit -m "feat: add /reset-password page"
```

---

## Task 9: Add "Forgot password?" Link to Login Page

**Files:**
- Modify: `src/app/login/page.tsx`
- Create: `src/app/login/__tests__/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/login/__tests__/page.test.tsx
// ABOUTME: Tests for the login page, specifically the "Forgot password?" link.
// ABOUTME: Verifies the link is present and points to /forgot-password.
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
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/app/login/__tests__/page.test.tsx 2>&1 | tail -15
```

Expected: FAIL — link not found

- [ ] **Step 3: Add the link to `src/app/login/page.tsx`**

Find the password input `<div>` block (lines 75-85) and add the link after the closing `</div>`:

```tsx
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <Link href="/forgot-password" className="text-sm text-purple-400 hover:text-purple-300">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-dark w-full rounded-lg px-4 py-2 text-white"
            />
          </div>
```

This replaces the existing password `<div>` block (which has only a bare label and input, no flex row).

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd /home/sabari/dev/code-vision && npx vitest run src/app/login/__tests__/page.test.tsx 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd /home/sabari/dev/code-vision && npx vitest run 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/login/page.tsx src/app/login/__tests__/page.test.tsx
git commit -m "feat: add Forgot password link to login page"
```
