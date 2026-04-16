# User Accounts — Profile, Usage & Onboarding Design

**Date:** 2026-04-16
**Status:** Approved

---

## Overview

Flesh out the user account experience: collect first/last name at signup, show a generated avatar with a dropdown in the navbar, and provide a dedicated `/account` page with Profile and Usage tabs.

---

## 1. Data Layer

### Migration `013_add_user_names.sql`
Add name fields to the `users` table:
```sql
ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN last_name  TEXT;
```
`first_name` defaults to `''` so existing users are not blocked. `last_name` is nullable.

### TypeScript `User` interface (`src/lib/db.ts`)
Add `first_name: string` and `last_name: string | null` to the `User` interface.

### API changes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/auth/signup` | Accept `first_name` (required) and `last_name` (optional) in body; write to users table on creation |
| `GET` | `/api/auth/me` | Return `first_name` and `last_name` alongside `id` and `email` |
| `PUT` | `/api/account/profile` | Authenticated. Update `first_name` (required, non-empty) and `last_name` (optional). Returns updated user. |
| `GET` | `/api/account/usage?month=YYYY-MM` | Authenticated. Return `{ total_cost_usd, tier, tier_limit_usd, events[] }`. `total_cost_usd` is the **lifetime** total from `user_credits`. `tier_limit_usd` is `5.00` for free, `null` for pro. `events` from `llm_usage_events` filtered to the given month. Defaults to current month if param omitted. |

---

## 2. Signup Page (`/signup`)

**New fields added above email:**
- `first_name` — required text input, labelled "First name"
- `last_name` — optional text input, labelled "Last name (optional)"

**Field order:** First name → Last name → Email → Password → Confirm password

**Validation:** `first_name` must be non-empty on submit; shows inline error. `last_name` is always optional.

**API call change:** Body gains `first_name` and `last_name`. All other signup logic (OTP flow, waitlist handling, domain check) is unchanged.

---

## 3. NavBar (`src/components/NavBar.tsx`)

**Authenticated state replaces** the current "email + Logout button" with:

### Avatar + Name
- 32px circle with user initials (e.g. "SS" for Sabari Sunil)
- Background color derived deterministically from the user's name — hash name to index into a palette of 6 colors that work on the dark glass background (purples, teals, greens, blues)
- Falls back to first character of email if `first_name` is empty
- First name displayed as plain text to the right of the avatar
- Entire avatar+name is a click target that opens the dropdown

### Dropdown (closes on outside click)
```
┌─────────────────────┐
│  [Free]             │  ← gray pill badge, or [Pro] purple pill
├─────────────────────┤
│  Profile            │  → navigates to /account
│  Usage              │  → navigates to /account?tab=usage
├─────────────────────┤  ← thin separator
│  Logout             │  ← red text
└─────────────────────┘
```

---

## 4. Account Page (`/account`)

Single `'use client'` page. Layout: two-column — narrow left sidebar (tabs), wide right content area.

### Back button
Top-left, `← Back`, calls `router.back()`. Styled as a subtle text link, not a heavy button.

### Left sidebar tabs
- "Profile" and "Usage" stacked vertically
- Active tab: purple left border highlight
- `?tab=usage` query param pre-selects the Usage tab (used by the navbar "Usage" link)
- Defaults to Profile tab if no param

---

### 4a. Profile Tab

**Read-only fields:**
- Avatar circle — 64px, same initials component as navbar
- Email — text input, visually grayed out, `disabled`

**Editable fields:**
- First name — required text input
- Last name — optional text input

**Save button** — calls `PUT /api/account/profile`. Shows inline success message on save, inline error on failure.

---

### 4b. Usage Tab

**Total spend card** (top of content area):
- Large `$X.XX` dollar amount — lifetime total from `user_credits`, not filtered by month
- Label: "Total spend"
- Progress bar: filled portion = `total_cost_usd / tier_limit_usd`. Free tier cap = $5.00. Pro tier (`tier_limit_usd = null`) shows bar as full-width solid purple with label "Unlimited".

**Month picker:**
- `← April 2026 →` navigation
- Defaults to current month
- Clicking arrows changes month; fetches `/api/account/usage?month=YYYY-MM`
- Cannot navigate to a future month

**Events table:**

| Column | Source |
|--------|--------|
| Date | `created_at` formatted as "Apr 16, 2026 14:32" in user's local timezone |
| Service | `service` (chat / analysis / alignment) |
| Model | `model` |
| Input tokens | `input_tokens` formatted with comma separators |
| Output tokens | `output_tokens` formatted with comma separators |
| Cost | `input_cost_usd + output_cost_usd` as `$0.0042` |

Empty state: "No usage recorded for this month." centered message.

---

## 5. Shared Component: InitialsAvatar

Reusable component used in both NavBar and Account Profile tab.

**Props:** `firstName: string`, `lastName: string | null`, `email: string`, `size: number` (px)

**Logic:**
- Initials = first char of `firstName` + first char of `lastName` if present, else just first char of `firstName`. Falls back to first char of `email` if `firstName` is empty.
- Color = `AVATAR_COLORS[hashString(firstName + lastName) % AVATAR_COLORS.length]`
- `AVATAR_COLORS` = 6 colors chosen to contrast well on dark glass backgrounds

---

## 6. `useAuth` hook update

Add `first_name: string` and `last_name: string | null` to the user type returned by the hook, populated from `/api/auth/me`.

---

## 7. Error Handling

- Profile save: network error or validation failure shows red inline message below save button
- Usage fetch failure: shows "Failed to load usage data. Try again." with a retry button
- Unauthenticated access to `/account`: redirect to `/login`

---

## 8. Out of Scope

- Tier upgrades / payment flow (tier is read-only display only)
- Password change on the profile page
- Avatar image upload
- Pagination of usage events (month scoping keeps row count manageable)
