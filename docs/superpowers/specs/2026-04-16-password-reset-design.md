# Password Reset — Design Spec

**Date:** 2026-04-16
**Feature:** Link-based password reset flow

---

## Overview

Users who forget their password can request a reset link via email. The link is valid for 1 hour and can only be used once. On success the user is redirected to login. Existing sessions are not invalidated (JWT cookies remain valid until their 7-day expiry).

---

## Architecture

Four layers of change:

1. **DB migration** — new `password_resets` table
2. **Repository layer** — new file for reset tokens, addition to users repository
3. **API routes** — two new endpoints
4. **Pages + email template** — two new pages, one new email function, one login page change

---

## Database

New migration file: `migrations/014_add_password_resets.sql`

```sql
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

Token storage: the raw token (32 random bytes as hex, 64 chars) is sent in the email URL. Only its SHA-256 hash is stored in the DB.

---

## Repository Layer

### New file: `src/lib/repositories/password-resets.ts`

- `createPasswordReset(userId: string): Promise<string>` — generates 32 random bytes via `crypto.randomBytes(32)`, stores SHA-256 hash with `expires_at = NOW() + 1 hour`, returns the raw hex token.
- `validateResetToken(rawToken: string): Promise<{ id: string; userId: string } | null>` — hashes the token, looks up by `token_hash` where `used_at IS NULL AND expires_at > NOW()`, returns `{ id, userId }` or null.
- `markTokenUsed(id: string): Promise<void>` — sets `used_at = NOW()` on the given row.

### Modified: `src/lib/repositories/users.ts`

- Add `updateUserPassword(userId: string, newPassword: string): Promise<void>` — hashes with bcrypt (10 rounds), updates `password_hash` and `updated_at`.

---

## API Routes

### `POST /api/auth/forgot-password`

**Request:** `{ email: string }`

**Logic:**
1. Look up user by email.
2. If user exists and `email_verified` is true: call `createPasswordReset(userId)`, call `sendPasswordResetEmail({ email, token })`.
3. Always respond `200 { message: "If that email is registered, you'll receive a reset link shortly" }` — never leak whether the email exists.
4. If email lookup throws, log the error server-side and still return 200.

### `POST /api/auth/reset-password`

**Request:** `{ token: string, password: string }`

**Logic:**
1. Validate `password.length >= 8`, return `400` if not.
2. Call `validateResetToken(token)`. If null, return `400 { error: "Reset link is invalid or has expired" }`.
3. Call `updateUserPassword(userId, password)` and `markTokenUsed(id)` in that order.
4. Return `200 { message: "Password updated successfully" }`.

---

## Email

### Modified: `src/lib/services/email.ts`

Add `sendPasswordResetEmail(data: { email: string; token: string }): Promise<void>`.

- Subject: "Reset your CodeVision password"
- Body: styled HTML matching the existing OTP email (purple gradient header, dark background)
- Contains a CTA button: "Reset Password" linking to `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${token}`
- Footer note: "This link expires in 1 hour. If you didn't request a password reset, you can ignore this email."

---

## Pages

### Modified: `src/app/login/page.tsx`

Add a "Forgot password?" link below the password input field:
- Styled: `text-sm text-purple-400 hover:text-purple-300`
- Links to `/forgot-password`

### New: `src/app/forgot-password/page.tsx`

Glass card layout matching login page.

- Email input + "Send reset link" button
- On submit: POST `/api/auth/forgot-password`, then display success message regardless of response: "If that email is registered, you'll receive a reset link shortly."
- Link back to login below the form.
- Loading state on button while request is in flight.

### New: `src/app/reset-password/page.tsx`

Glass card layout. Reads `token` from URL search params.

- Two inputs: "New password" and "Confirm password"
- Client-side validation: passwords match and length ≥ 8 characters
- On submit: POST `/api/auth/reset-password` with `{ token, password }`
- On success: show "Password reset! Redirecting to login..." then `router.push('/login')` after 2 seconds
- On error (invalid/expired token): show the server error message + link to `/forgot-password`
- Loading state on button while request is in flight

---

## Testing

### API route tests

`src/app/api/__tests__/forgot-password-route.test.ts`
- Returns 200 when email exists and is verified
- Returns 200 when email does not exist (no leak)
- Calls `sendPasswordResetEmail` only when user exists

`src/app/api/__tests__/reset-password-route.test.ts`
- Returns 200 and updates password on valid token
- Returns 400 on expired token
- Returns 400 on already-used token
- Returns 400 when password is shorter than 8 characters
- Returns 400 on token not found

### Repository tests

`src/lib/repositories/__tests__/password-resets.test.ts`
- `createPasswordReset` stores a hash, not the raw token
- `validateResetToken` returns null for expired tokens
- `validateResetToken` returns null for used tokens
- `markTokenUsed` sets `used_at`

### Component tests

`src/app/forgot-password/__tests__/page.test.tsx`
- Renders email input and submit button
- Shows success message after submit (regardless of API response)

`src/app/reset-password/__tests__/page.test.tsx`
- Renders password + confirm inputs
- Shows validation error when passwords don't match
- Shows validation error when password < 8 chars
- Shows success state on valid API response
- Shows error message on invalid token API response

---

## What Does Not Change

- JWT token structure or expiry
- Existing sessions — not invalidated on password reset
- `email_verifications` table — not reused
- Signup, login, verify-email, logout flows
