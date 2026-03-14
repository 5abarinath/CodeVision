# Code Vision

A Next.js application that analyzes GitHub repositories to surface architecture maps, business flow views, and risk intelligence — powered by Claude AI.

## Prerequisites

- **Node.js** v20+ and npm
- **Supabase** account (free tier works)
- **Anthropic API key** ([console.anthropic.com](https://console.anthropic.com))
- **Resend API key** ([resend.com](https://resend.com)) — used for email verification

---

## 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → API** and note your:
   - **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
   - **anon / public key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role key** (`SUPABASE_SERVICE_ROLE_KEY`)
3. Open the **SQL Editor** in your Supabase dashboard and run all migration files in order:

```
migrations/001_initial_setup.sql
migrations/002_northwestern_features.sql
migrations/003_feedback_table.sql
migrations/004_add_git_metadata_to_analysis.sql
migrations/005_create_workspaces_table.sql
migrations/006_create_elements_table.sql
migrations/007_add_email_verification.sql
migrations/008_add_business_lenses_to_analysis.sql
migrations/009_add_founder_content.sql
migrations/010_add_business_context.sql
```

Paste each file's contents into the SQL Editor and click **Run**, in the order listed above.

---

## 2. Environment Variables

Copy the example env file:

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Auth
JWT_SECRET=<any-long-random-string>

# Email domain allowlist — change to your domain or use "gmail.com" for open testing
ALLOWED_EMAIL_DOMAINS=northwestern.edu

# AI
ANTHROPIC_API_KEY=<your-anthropic-api-key>

# Email (for verification emails)
RESEND_API_KEY=<your-resend-api-key>
```

> **Note on `ALLOWED_EMAIL_DOMAINS`**: Only email addresses from this domain can sign up. For local testing with a personal email, change this to your email's domain (e.g., `gmail.com`).

---

## 3. Install Dependencies

```bash
npm install
```

---

## 4. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Using the App

1. **Sign up** with an email address matching `ALLOWED_EMAIL_DOMAINS`.
2. **Verify your email** — check your inbox for a verification link (sent via Resend).
3. **Create a new analysis** — paste a public GitHub repository URL and a GitHub Personal Access Token.
4. Wait for the analysis to complete (this may take 1–3 minutes depending on repo size).
5. Explore the **Architecture Map**, **Modules**, **User Flow**, and **Risks** tabs.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests (requires running server) |
| `npm run lint` | Run linter |

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security)
- **AI**: Anthropic Claude via `@anthropic-ai/sdk`
- **Email**: Resend
