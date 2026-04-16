# User Accounts — Profile, Usage & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first/last name to signup, replace the NavBar email+logout with an initials avatar dropdown, and build an `/account` page with Profile and Usage tabs.

**Architecture:** Nine sequential tasks — data layer first (migration, types, repositories), then API endpoints, then UI (signup form, avatar component, NavBar, account page). Each task is independently committable.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (service role), Zod, Vitest, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-16-user-accounts-design.md`

---

## File Structure

### New files
| File | Purpose |
|------|---------|
| `migrations/013_add_user_names.sql` | Add `first_name`, `last_name` to `users` |
| `src/app/api/account/profile/route.ts` | `PUT` — update user name fields |
| `src/app/api/account/usage/route.ts` | `GET` — usage events + lifetime total by month |
| `src/app/account/page.tsx` | `/account` page with Profile and Usage tabs |
| `src/components/InitialsAvatar.tsx` | Reusable initials-on-circle avatar |
| `src/app/api/__tests__/signup-names.test.ts` | Tests for signup name acceptance |
| `src/app/api/__tests__/account-profile-route.test.ts` | Tests for profile endpoint |
| `src/app/api/__tests__/account-usage-route.test.ts` | Tests for usage endpoint |
| `src/components/__tests__/InitialsAvatar.test.tsx` | Tests for avatar component |

### Modified files
| File | Changes |
|------|---------|
| `src/lib/db.ts` | Add `first_name`, `last_name`, `tier` to `User` interface |
| `src/lib/repositories/users.ts` | `CreateUserInput` + `createUser` accept name fields |
| `src/app/api/auth/signup/route.ts` | Zod schema + `createUser` call gain name fields |
| `src/app/api/auth/me/route.ts` | Return `first_name`, `last_name`, `tier` |
| `src/app/signup/page.tsx` | Add first/last name fields above email |
| `src/lib/hooks/useAuth.ts` | `User` type gains `first_name`, `last_name`, `tier` |
| `src/components/NavBar.tsx` | Replace email+logout with avatar+dropdown |

---

## Task 1: Migration and User type

**Files:**
- Create: `migrations/013_add_user_names.sql`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/repositories/users.ts`

- [ ] **Step 1: Create migration**

Create `migrations/013_add_user_names.sql`:
```sql
-- ABOUTME: Adds first_name and last_name columns to the users table for personalization.
-- ABOUTME: first_name defaults to '' so existing users are not blocked; last_name is nullable.

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
```

- [ ] **Step 2: Update User interface in `src/lib/db.ts`**

Replace the existing `User` interface (currently at line 23):
```typescript
export interface User {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  first_name: string;
  last_name: string | null;
  tier: string;
  created_at: string;
}
```

- [ ] **Step 3: Update `CreateUserInput` and `createUser` in `src/lib/repositories/users.ts`**

Replace the file contents:
```typescript
// ABOUTME: Repository functions for creating and querying users in the Supabase users table.
// ABOUTME: Handles password hashing and exposes typed wrappers around raw Supabase queries.
import { supabase } from '../db';
import type { User } from '../db';
import bcrypt from 'bcryptjs';

export interface CreateUserInput {
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const password_hash = await bcrypt.hash(input.password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert({
      email: input.email.toLowerCase(),
      password_hash,
      first_name: input.first_name,
      last_name: input.last_name ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data as User;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as User;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error) return null;
  return data as User;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add migrations/013_add_user_names.sql src/lib/db.ts src/lib/repositories/users.ts
git commit -m "feat: add first_name and last_name to users table and User type"
```

---

## Task 2: Signup API — accept names

**Files:**
- Modify: `src/app/api/auth/signup/route.ts`
- Create: `src/app/api/__tests__/signup-names.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/__tests__/signup-names.test.ts`:
```typescript
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
      body: JSON.stringify({ email: 'test@northwestern.edu', password: 'password123' }),
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/app/api/__tests__/signup-names.test.ts
```
Expected: FAIL — `first_name` validation not yet in schema.

- [ ] **Step 3: Update signup route**

In `src/app/api/auth/signup/route.ts`:

Replace `SignupSchema`:
```typescript
const SignupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
});
```

Replace `const { email, password } = parsed.data;` with:
```typescript
const { email, password, first_name, last_name } = parsed.data;
```

Replace `const user = await createUser({ email, password });` with:
```typescript
const user = await createUser({ email, password, first_name, last_name });
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/api/__tests__/signup-names.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/signup/route.ts src/app/api/__tests__/signup-names.test.ts
git commit -m "feat: accept first_name and last_name in signup API"
```

---

## Task 3: Me API + useAuth — expose names and tier

**Files:**
- Modify: `src/app/api/auth/me/route.ts`
- Modify: `src/lib/hooks/useAuth.ts`

- [ ] **Step 1: Update me route**

Replace `src/app/api/auth/me/route.ts`:
```typescript
// ABOUTME: Returns the authenticated user's public profile fields from their session cookie.
// ABOUTME: Used by the client-side useAuth hook to populate user state on page load.
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      tier: user.tier,
    },
  });
}
```

- [ ] **Step 2: Update `User` type in `src/lib/hooks/useAuth.ts`**

Replace the `User` interface (lines 6-9):
```typescript
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  tier: string;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/me/route.ts src/lib/hooks/useAuth.ts
git commit -m "feat: expose first_name, last_name, and tier from /api/auth/me"
```

---

## Task 4: Profile API endpoint

**Files:**
- Create: `src/app/api/account/profile/route.ts`
- Create: `src/app/api/__tests__/account-profile-route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/__tests__/account-profile-route.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/app/api/__tests__/account-profile-route.test.ts
```
Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Create profile route**

Create `src/app/api/account/profile/route.ts`:
```typescript
// ABOUTME: Authenticated endpoint to update a user's first and last name.
// ABOUTME: Validates input with Zod, writes to users table, and returns the updated fields.
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { supabase } from '@/lib/db';
import { z } from 'zod';

const ProfileUpdateSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = ProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { first_name, last_name } = parsed.data;

  const { data, error } = await supabase
    .from('users')
    .update({ first_name, last_name: last_name ?? null, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('id, email, first_name, last_name, tier')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/api/__tests__/account-profile-route.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/account/profile/route.ts src/app/api/__tests__/account-profile-route.test.ts
git commit -m "feat: add PUT /api/account/profile endpoint"
```

---

## Task 5: Usage API endpoint

**Files:**
- Create: `src/app/api/account/usage/route.ts`
- Create: `src/app/api/__tests__/account-usage-route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/__tests__/account-usage-route.test.ts`:
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: vi.fn(async () => ({
    id: 'user-1', email: 'test@northwestern.edu', first_name: 'Test', last_name: null, tier: 'free',
  })),
}));

const mockFrom = vi.fn();
vi.mock('@/lib/db', () => ({ supabase: { from: mockFrom } }));

describe('GET /api/account/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_credits') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { total_cost_usd: 1.5 }, error: null }) }) }) };
      }
      if (table === 'admin_config') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { value: { free: 5.0, pro: null } }, error: null }) }) }) };
      }
      if (table === 'llm_usage_events') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: () => ({
                  order: async () => ({
                    data: [{ id: 'e1', created_at: '2026-04-10T12:00:00Z', service: 'chat', model: 'claude-sonnet-4-20250514', input_tokens: 100, output_tokens: 50, input_cost_usd: 0.0003, output_cost_usd: 0.00075 }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
    });
  });

  it('returns total_cost_usd, tier, tier_limit_usd, and monthly events', async () => {
    const { GET } = await import('@/app/api/account/usage/route');
    const response = await GET(new NextRequest('http://localhost/api/account/usage?month=2026-04'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total_cost_usd).toBe(1.5);
    expect(body.tier).toBe('free');
    expect(body.tier_limit_usd).toBe(5.0);
    expect(body.events).toHaveLength(1);
  });

  it('returns 400 for invalid month format', async () => {
    const { GET } = await import('@/app/api/account/usage/route');
    const response = await GET(new NextRequest('http://localhost/api/account/usage?month=not-a-month'));
    expect(response.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const { getUserFromRequest } = await import('@/lib/auth');
    vi.mocked(getUserFromRequest).mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/account/usage/route');
    const response = await GET(new NextRequest('http://localhost/api/account/usage?month=2026-04'));
    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/app/api/__tests__/account-usage-route.test.ts
```
Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Create usage route**

Create `src/app/api/account/usage/route.ts`:
```typescript
// ABOUTME: Authenticated endpoint returning a user's LLM usage for a given calendar month.
// ABOUTME: Returns lifetime total from user_credits, tier limit from admin_config, and month-filtered events.
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
  }

  const periodStart = new Date(`${monthParam}-01T00:00:00.000Z`);
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const [creditsResult, configResult, eventsResult] = await Promise.all([
    supabase.from('user_credits').select('total_cost_usd').eq('user_id', user.id).single(),
    supabase.from('admin_config').select('value').eq('key', 'tier_limits').single(),
    supabase
      .from('llm_usage_events')
      .select('id, created_at, service, model, input_tokens, output_tokens, input_cost_usd, output_cost_usd')
      .eq('user_id', user.id)
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', periodEnd.toISOString())
      .order('created_at', { ascending: false }),
  ]);

  if (eventsResult.error) {
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
  }

  const total_cost_usd: number = creditsResult.data
    ? (creditsResult.data as { total_cost_usd: number }).total_cost_usd
    : 0;

  const tierLimits: Record<string, number | null> = configResult.data
    ? (configResult.data as { value: Record<string, number | null> }).value
    : { free: 5.0, pro: null };

  return NextResponse.json({
    total_cost_usd,
    tier: user.tier,
    tier_limit_usd: tierLimits[user.tier] ?? null,
    events: eventsResult.data ?? [],
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/api/__tests__/account-usage-route.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/account/usage/route.ts src/app/api/__tests__/account-usage-route.test.ts
git commit -m "feat: add GET /api/account/usage endpoint"
```

---

## Task 6: Signup page UI — add name fields

**Files:**
- Modify: `src/app/signup/page.tsx`

- [ ] **Step 1: Add state variables**

In `src/app/signup/page.tsx`, add after `const [waitlistSuccess, setWaitlistSuccess] = useState(false);`:
```typescript
const [firstName, setFirstName] = useState('');
const [lastName, setLastName] = useState('');
```

- [ ] **Step 2: Add first_name validation to `handleSubmit`**

Add after `setError('')` at the top of `handleSubmit`:
```typescript
if (!firstName.trim()) {
  setError('First name is required');
  return;
}
```

- [ ] **Step 3: Include names in fetch body**

Replace `body: JSON.stringify({ email, password }),` with:
```typescript
body: JSON.stringify({ email, password, first_name: firstName.trim(), last_name: lastName.trim() || undefined }),
```

- [ ] **Step 4: Add form fields before the email field**

Add before the email `<div>` block inside the form:
```tsx
<div>
  <label className="block text-sm font-medium text-gray-300 mb-1">
    First name
  </label>
  <input
    type="text"
    value={firstName}
    onChange={(e) => setFirstName(e.target.value)}
    required
    className="input-dark w-full rounded-lg px-4 py-2 text-white"
    placeholder="First name"
  />
</div>

<div>
  <label className="block text-sm font-medium text-gray-300 mb-1">
    Last name <span className="text-gray-500">(optional)</span>
  </label>
  <input
    type="text"
    value={lastName}
    onChange={(e) => setLastName(e.target.value)}
    className="input-dark w-full rounded-lg px-4 py-2 text-white"
    placeholder="Last name (optional)"
  />
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/signup/page.tsx
git commit -m "feat: add first and last name fields to signup page"
```

---

## Task 7: InitialsAvatar component

**Files:**
- Create: `src/components/InitialsAvatar.tsx`
- Create: `src/components/__tests__/InitialsAvatar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/InitialsAvatar.test.tsx`:
```typescript
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import InitialsAvatar from '@/components/InitialsAvatar';

describe('InitialsAvatar', () => {
  it('shows two initials when first and last name provided', () => {
    const { container } = render(
      <InitialsAvatar firstName="Sabari" lastName="Sunil" email="s@example.com" size={32} />
    );
    expect(container.textContent).toBe('SS');
  });

  it('shows one initial when only first name provided', () => {
    const { container } = render(
      <InitialsAvatar firstName="Sabari" lastName={null} email="s@example.com" size={32} />
    );
    expect(container.textContent).toBe('S');
  });

  it('falls back to email initial when first_name is empty', () => {
    const { container } = render(
      <InitialsAvatar firstName="" lastName={null} email="sabari@example.com" size={32} />
    );
    expect(container.textContent).toBe('S');
  });

  it('applies specified size as width and height with border-radius 50%', () => {
    const { container } = render(
      <InitialsAvatar firstName="Test" lastName={null} email="t@example.com" size={64} />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.style.width).toBe('64px');
    expect(div.style.height).toBe('64px');
    expect(div.style.borderRadius).toBe('50%');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/components/__tests__/InitialsAvatar.test.tsx
```
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Create component**

Create `src/components/InitialsAvatar.tsx`:
```tsx
// ABOUTME: Renders user initials inside a deterministically colored circle avatar.
// ABOUTME: Color is derived from a hash of the user's name; falls back to email initial if name is empty.

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#0D9488', '#16A34A', '#4F46E5', '#0891B2'];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(firstName: string, lastName: string | null, email: string): string {
  if (firstName) {
    return (firstName[0] + (lastName ? lastName[0] : '')).toUpperCase();
  }
  return email[0].toUpperCase();
}

interface InitialsAvatarProps {
  firstName: string;
  lastName: string | null;
  email: string;
  size: number;
}

export default function InitialsAvatar({ firstName, lastName, email, size }: InitialsAvatarProps) {
  const initials = getInitials(firstName, lastName, email);
  const color = AVATAR_COLORS[hashString(firstName + (lastName ?? '')) % AVATAR_COLORS.length];

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.floor(size * 0.4),
        fontWeight: 600,
        color: '#fff',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/components/__tests__/InitialsAvatar.test.tsx
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/InitialsAvatar.tsx src/components/__tests__/InitialsAvatar.test.tsx
git commit -m "feat: add InitialsAvatar component"
```

---

## Task 8: NavBar redesign

**Files:**
- Modify: `src/components/NavBar.tsx`

- [ ] **Step 1: Replace NavBar contents**

Replace the entire contents of `src/components/NavBar.tsx`:
```tsx
// ABOUTME: Top navigation bar with logo and authenticated user menu.
// ABOUTME: Shows initials avatar and first name; clicking opens a dropdown with tier badge, account links, and logout.
'use client';

import Link from 'next/link';
import { useRef, useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { LogoFull } from '@/components/Logo';
import InitialsAvatar from '@/components/InitialsAvatar';

export default function NavBar() {
  const { user, loading, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="glass-strong sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="group">
              <LogoFull className="group-hover:opacity-80 transition-opacity" />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {loading ? (
              <span className="text-sm text-gray-400">Loading...</span>
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(prev => !prev)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <InitialsAvatar
                    firstName={user.first_name}
                    lastName={user.last_name}
                    email={user.email}
                    size={32}
                  />
                  <span className="text-sm text-gray-300">
                    {user.first_name || user.email.split('@')[0]}
                  </span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 glass rounded-xl border border-white/10 shadow-lg py-1 z-50">
                    <div className="px-3 py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        user.tier === 'pro'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}>
                        {user.tier === 'pro' ? 'Pro' : 'Free'}
                      </span>
                    </div>
                    <Link
                      href="/account"
                      className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      href="/account?tab=usage"
                      className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Usage
                    </Link>
                    <hr className="my-1 border-white/10" />
                    <button
                      onClick={() => { setDropdownOpen(false); void logout(); }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Login
                </Link>
                <Link href="/signup" className="btn-primary px-4 py-2 text-sm text-white rounded-lg">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/NavBar.tsx
git commit -m "feat: replace NavBar email+logout with initials avatar dropdown"
```

---

## Task 9: Account page

**Files:**
- Create: `src/app/account/page.tsx`

- [ ] **Step 1: Create account page**

Create `src/app/account/page.tsx`:
```tsx
// ABOUTME: Account management page with Profile and Usage tabs accessible from the navbar dropdown.
// ABOUTME: Profile tab allows editing name; Usage tab shows monthly LLM spend and per-call event history.
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import InitialsAvatar from '@/components/InitialsAvatar';

interface UsageEvent {
  id: string;
  created_at: string;
  service: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
}

interface UsageData {
  total_cost_usd: number;
  tier: string;
  tier_limit_usd: number | null;
  events: UsageEvent[];
}

function AccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'usage'>(
    searchParams.get('tab') === 'usage' ? 'usage' : 'profile'
  );

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchUsage = useCallback(async (month: string) => {
    setUsageLoading(true);
    setUsageError('');
    try {
      const res = await fetch(`/api/account/usage?month=${month}`);
      if (!res.ok) throw new Error('Failed to load usage');
      setUsageData(await res.json());
    } catch {
      setUsageError('Failed to load usage data. Try again.');
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'usage' && user) {
      void fetchUsage(currentMonth);
    }
  }, [activeTab, currentMonth, user, fetchUsage]);

  const handleProfileSave = async () => {
    setProfileError('');
    setProfileSuccess(false);
    if (!firstName.trim()) { setProfileError('First name is required'); return; }
    setProfileSaving(true);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to save'); }
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setProfileSaving(false);
    }
  };

  const navigateMonth = (direction: -1 | 1) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + direction, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (next <= new Date().toISOString().slice(0, 7)) setCurrentMonth(next);
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-').map(Number);
    return new Date(year, m - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-8"
        >
          ← Back
        </button>

        <div className="flex gap-8">
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              {(['profile', 'usage'] as const).map(tab => (
                <li key={tab}>
                  <button
                    onClick={() => setActiveTab(tab)}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                      activeTab === tab
                        ? 'border-l-2 border-purple-500 text-white bg-white/5'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex-1 glass rounded-xl p-6">
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Profile</h2>

                <div className="flex items-center gap-4 mb-6">
                  <InitialsAvatar firstName={user.first_name} lastName={user.last_name} email={user.email} size={64} />
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="input-dark rounded-lg px-4 py-2 text-gray-400 opacity-50 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="input-dark w-full rounded-lg px-4 py-2 text-white"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Last name <span className="text-gray-500">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="input-dark w-full rounded-lg px-4 py-2 text-white"
                      placeholder="Last name (optional)"
                    />
                  </div>
                </div>

                {profileError && <p className="mt-3 text-sm text-red-400">{profileError}</p>}
                {profileSuccess && <p className="mt-3 text-sm text-green-400">Profile saved successfully.</p>}

                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="btn-primary mt-6 px-6 py-2 rounded-lg text-white font-medium"
                >
                  {profileSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}

            {activeTab === 'usage' && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Usage</h2>

                {usageLoading && <p className="text-gray-400 text-sm">Loading...</p>}

                {usageError && (
                  <div className="mb-4">
                    <p className="text-red-400 text-sm">{usageError}</p>
                    <button onClick={() => void fetchUsage(currentMonth)} className="mt-2 text-sm text-purple-400 hover:text-purple-300">
                      Try again
                    </button>
                  </div>
                )}

                {usageData && (
                  <>
                    <div className="glass rounded-xl p-5 mb-6">
                      <p className="text-sm text-gray-400 mb-1">Total spend</p>
                      <p className="text-4xl font-bold text-white mb-3">${usageData.total_cost_usd.toFixed(4)}</p>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        {usageData.tier_limit_usd === null ? (
                          <div className="bg-purple-500 h-2 rounded-full w-full" />
                        ) : (
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${Math.min(100, (usageData.total_cost_usd / usageData.tier_limit_usd) * 100)}%` }}
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {usageData.tier_limit_usd === null
                          ? 'Unlimited'
                          : `$${usageData.total_cost_usd.toFixed(4)} of $${usageData.tier_limit_usd.toFixed(2)} limit`}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <button onClick={() => navigateMonth(-1)} className="text-gray-400 hover:text-white transition-colors px-2">←</button>
                      <span className="text-sm text-gray-300 min-w-32 text-center">{formatMonth(currentMonth)}</span>
                      <button
                        onClick={() => navigateMonth(1)}
                        disabled={currentMonth >= new Date().toISOString().slice(0, 7)}
                        className="text-gray-400 hover:text-white transition-colors px-2 disabled:opacity-30"
                      >→</button>
                    </div>

                    {usageData.events.length === 0 ? (
                      <p className="text-center text-gray-500 py-8 text-sm">No usage recorded for this month.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 border-b border-white/10 text-left">
                              <th className="pb-2 pr-4 font-medium">Date</th>
                              <th className="pb-2 pr-4 font-medium">Service</th>
                              <th className="pb-2 pr-4 font-medium">Model</th>
                              <th className="pb-2 pr-4 font-medium text-right">Input</th>
                              <th className="pb-2 pr-4 font-medium text-right">Output</th>
                              <th className="pb-2 font-medium text-right">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageData.events.map(event => (
                              <tr key={event.id} className="border-b border-white/5 text-gray-300">
                                <td className="py-2 pr-4 text-xs">
                                  {new Date(event.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                                  {new Date(event.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-2 pr-4 capitalize">{event.service}</td>
                                <td className="py-2 pr-4 font-mono text-xs">{event.model}</td>
                                <td className="py-2 pr-4 text-right">{event.input_tokens.toLocaleString()}</td>
                                <td className="py-2 pr-4 text-right">{event.output_tokens.toLocaleString()}</td>
                                <td className="py-2 text-right">${(event.input_cost_usd + event.output_cost_usd).toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="text-gray-400">Loading...</span></div>}>
      <AccountContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```
Expected: all tests PASS.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/account/page.tsx
git commit -m "feat: add /account page with Profile and Usage tabs"
```
