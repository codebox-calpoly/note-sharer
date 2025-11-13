# Tech Stack & Architecture
_Date: November 10, 2025

> Goal: a simple, low-cost MVP deployable on **Vercel** using **Supabase** for database, auth, and storage. Campus-scoped (Cal Poly SLO), **PDF-only** uploads, **credit economy**, **pseudonymous handles**, and **teaser previews**. Designed so a small student team can build, test, and iterate fast.

---

## 1) High-Level Architecture

```mermaid
flowchart TD
  U[User (Browser)] -->|HTTPS| V[Vercel: Next.js App]
  V -->|Server Actions / API Routes| SB[(Supabase Postgres)]
  V -->|Signed URLs| ST[(Supabase Storage)]
  V -->|Auth Session| SA[(Supabase Auth)]
  V -->|Analytics| AN[(Vercel Analytics / PostHog)]
  V -->|Rate limit (optional)| R[(Upstash Redis)]
```
- **Frontend + Backend** live in one **Next.js** app (App Router) on **Vercel**.
- **Database/Auth/Storage** are provided by **Supabase** (managed Postgres + Auth + S3-compatible Storage).
- **Security**: Postgres **RLS** + app-side checks; Storage gated by **signed URLs**; domain-allowlisted auth.
- **Teaser & pHash** generated **client-side** (no heavy servers).
- **Jobs/Cron** via **Vercel Cron** (e.g., term rollover, cleanups).

---

## 2) Core Stack

### Frontend
- **Framework**: Next.js (App Router) + **TypeScript**
- **Styling/UI**: Tailwind CSS, **shadcn/ui**, lucide-react
- **Forms & Validation**: React Hook Form + **Zod**
- **Data fetching**: **TanStack Query** (client caching) + Server Actions for mutations
- **PDF teaser**: `pdfjs-dist` (render page 1 to canvas → blur → PNG)
- **pHash**: lightweight JS/DCT-based hash on teaser image (e.g., `image-phash` or custom)

### Backend (within Next.js on Vercel)
- **API**: Route handlers & Server Actions for resource CRUD, voting, reporting, downloads
- **Auth**: **Supabase Auth** (email-based). _Auth mode switcher supported (see §3)._
- **Rate limiting (optional)**: Vercel Middleware + **Upstash Redis**
- **Email**: Supabase SMTP or **Resend**

### Data & Storage
- **Database**: Supabase **Postgres** (+ extensions for UUIDs, tsvector)
- **Schema**: `profiles`, `user_roles`, `courses`, `course_submissions`, `resources`, `votes`, `credits_ledger`, `reports`
- **Search**: Postgres **FTS** on `resources.title`, **trigram** index for fuzzy
- **Storage**: Supabase Storage buckets: `resources/` (PDFs), `previews/` (PNG teasers)
- **Gating**: **signed URLs** created server-side after credit/voucher checks

### Observability
- **Perf/analytics**: Vercel Analytics/Speed Insights; optional **PostHog**
- **Errors**: optional **Sentry** (browser + server)

---

## 3) Authentication Modes (Configurable)

- **MVP Default (current PRD):** **Email OTP** (calpoly.edu allowlist) + **Handle Claim** (pseudonymous).  
- **Alternate (your idea):** **OTP once → Set Password → Password logins thereafter**.  
  - Keep **password reset** via email.  
  - Switch controlled by an environment flag (e.g., `AUTH_MODE=otp_only | otp_then_password`).

**Always enforce:** `@calpoly.edu` domain on signup; never expose emails publicly. Handles are unique and immutable for MVP.

---

## 4) Key Features → Stack Mapping

| Feature | Where it runs | Libraries/Notes |
|---|---|---|
| PDF upload | Browser → Supabase Storage | Native file input; server validates MIME |
| Teaser (blurred first page) | **Client** | `pdfjs-dist` → canvas → PNG → upload `previews/` |
| Perceptual hash (duplicates) | **Client** (then checked on server) | compute pHash on teaser; server compares Hamming distance |
| Credit economy | **DB triggers + RPC** | +5 on upload; +1 per new upvote (cap 10); `rpc_consume_download()` deducts |
| Voting (up/down) | Client UI + API → DB trigger | UPSERT `(user_id, resource_id)`; trigger updates counts & credits |
| Download gating | API → RPC → signed URL | Vouchers first (2), then 3 credits |
| Search & Sort | SQL (FTS + time-decay) | Recent (default) or Top toggle; remember per user |
| Reporting & Mod tools | API + protected routes | Weighted reports (TA/teacher>student); takedown by mods |

---

## 5) Project Structure (suggested)

```
/app
  /(auth)/sign-in
  /(setup)/handle
  /(courses)/[courseId]/page.tsx
  /(mods)/queue/page.tsx
  /api/
    courses/route.ts
    course-submissions/route.ts
    resources/create/route.ts
    resources/sign-download/route.ts
    votes/route.ts
    reports/route.ts
  layout.tsx, globals.css
/lib
  db.ts, supabase-server.ts, auth.ts, validation.ts
/components
  uploader/, pdf-teaser/, resource-card/, vote-button/, report-button/
/sql or /drizzle
/tests (unit + e2e)
```

---

## 6) API Surface (contracts, no code)

- `GET /api/courses?q=&term=&cursor=` — list/search courses
- `POST /api/course-submissions` — submit missing course
- `GET /api/course-submissions/mine` — my submissions
- `GET /api/mod/submissions` — moderator queue
- `POST /api/mod/submissions/:id/approve|reject` — review actions
- `POST /api/resources/create` — create resource (file_key, teaser_key, phash, …)
- `POST /api/resources/sign-download` — returns **signed URL** after `rpc_consume_download`
- `POST /api/votes` — upsert vote
- `POST /api/reports` — file a report
- `GET /api/me` — `{ id, handle }`
- `POST /api/me/handle` — claim handle

> All endpoints require an authenticated session; **RLS** additionally protects DB operations.

---

## 7) Environment Variables (minimum)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` _(server only)_
- `AUTH_MODE=otp_only | otp_then_password`
- `EMAIL_FROM`, `SMTP_*` **or** `RESEND_API_KEY`
- `NEXT_PUBLIC_SITE_URL` (for email links)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` _(optional rate limit)_
- `POSTHOG_KEY`, `SENTRY_DSN` _(optional)_

> Configure **Vercel Environment Variables** for **Preview** and **Production** separately.

---

## 8) Deployment & Environments

- **Branches**: `main` (prod), `develop` (staging), `feature/*` (PRs).  
- **Vercel**: Preview deployments on PRs; Production from `main`.  
- **Supabase**: one project per env (dev/stage/prod) _or_ 1 prod + local dev via CLI.  
- **Migrations**: Drizzle or raw SQL in `/sql`; run via CI before app deploy.

---

## 9) Security Checklist (MVP)

- [ ] Postgres **RLS** enabled on all tables (Issue #1).  
- [ ] Auth allowlist: only `@calpoly.edu` can register.  
- [ ] Handles: unique, reserved words blocked, no email-like strings.  
- [ ] Storage access only via **short-TTL signed URLs**.  
- [ ] Input validation via **Zod** on all endpoints.  
- [ ] Rate limiting on uploads/votes/reports (optional but recommended).  
- [ ] No PII in public responses; logs redact emails.  
- [ ] DMCA/takedown workflow documented (mod UI + timestamps).

---

## 10) Cost Posture (free/small-scale friendly)

- **Vercel Hobby**: free previews + limited bandwidth.  
- **Supabase Free**: Postgres, Auth, Storage within quota.  
- **Optional**: Upstash, Resend, PostHog, Sentry — all have free/dev tiers.

> If previews or storage exceed free limits, set quotas (max PDF size 25 MB) and housekeeping jobs.

---

## 11) Scalability Roadmap

- Move teaser/pHash to Edge Functions if client perf is poor.  
- Materialized views for “Top” ranking and per-course stats.  
- Supabase Row Replication or CDC (if you add search indexers later).  
- Duo SSO integration; dynamic pricing; recommendations; advanced mod tooling.

---

## 12) Team Onboarding (Day 0 Checklist)

- [ ] Install Node + PNPM/Yarn, Git, IDE, Supabase CLI.  
- [ ] `cp .env.example .env.local` (fill Supabase anon keys).  
- [ ] `supabase start` for local DB (optional); or use dev Supabase project.  
- [ ] Run migrations; confirm tables & RLS exist.  
- [ ] `pnpm dev` → app boots; mock APIs return contract-shaped data.

---
