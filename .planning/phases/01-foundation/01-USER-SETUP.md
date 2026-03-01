# Phase 01 — User Setup

**Status:** Incomplete — action required before running the app with auth

---

## Supabase Setup

**Why:** ChemoSys uses Supabase for database (PostgreSQL) and authentication (email + password). Without a Supabase project, the app cannot connect to a database or authenticate users.

### Step 1: Create a Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Name it: `chemosys` (or similar)
4. Select region: closest to Israel (e.g., EU West)
5. Set a strong database password — save it somewhere secure
6. Wait for project to provision (~2 minutes)

### Step 2: Get Your API Keys

Go to: **Project Settings → API**

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API → **Project API keys → anon/public** (or "publishable") |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → **Project API keys → service_role** (secret — keep private) |

### Step 3: Update .env.local

Edit `C:/Sharon_ClaudeCode/Apps/ChemoSystem/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANT:**
- `SUPABASE_SERVICE_ROLE_KEY` does NOT have `NEXT_PUBLIC_` prefix — it must never be exposed to the browser
- Do NOT commit `.env.local` to git (it is already in `.gitignore`)

### Step 4: Verify Connection

After filling in `.env.local`, run the app:

```bash
cd C:/Sharon_ClaudeCode/Apps/ChemoSystem
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) — you should be redirected to `/login`.

If you see an error about Supabase connection, check:
1. The URL and keys are copied correctly (no trailing spaces)
2. The Supabase project is fully provisioned (green status in dashboard)

---

## Dashboard Configuration

| Task | Location | Notes |
|------|----------|-------|
| Enable Email Auth | Authentication → Providers → Email | Should be enabled by default |
| Disable email confirmation (dev only) | Authentication → Settings → Email → Confirm Email | Set to OFF for faster dev iteration |
| Add first admin user | Authentication → Users → Add User | Email + password for initial login |

---

## Notes for Developers

- `.env.local` is git-ignored — each developer needs their own copy
- The app will start without Supabase credentials but auth will fail
- `proxy.ts` will redirect all `/admin/*` routes to `/login` until auth is configured
- Run Plan 01-02 DB migration after Supabase project is ready (SQL migration file)
