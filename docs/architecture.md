# Architecture

Poly Pages is a Next.js app backed by Supabase. The app lives in `frontend/`; database migrations and Supabase setup live in `supabase/`.

## App Shape

- `frontend/app/page.tsx` is the public landing page.
- `frontend/app/auth` handles Cal Poly email sign-in.
- `frontend/app/onboarding` collects first-time profile and enrollment details.
- `frontend/app/(poly)` contains the signed-in app shell.
- `frontend/app/(poly)/dashboard` is the main course and resource browsing area.
- `frontend/app/(poly)/upload` handles resource uploads.
- `frontend/app/(poly)/moderator` is the moderation surface.
- `frontend/app/(poly)/leaderboard` shows campus contribution rankings.
- `frontend/app/api` contains server routes for auth, notes, credits, catalog search, moderation, and uploads.

## Data

Supabase provides:

- Auth for verified student accounts.
- Postgres tables for profiles, courses, resources, credits, votes, reports, bookmarks, and moderation data.
- Storage buckets for uploaded PDFs and generated previews.

Schema changes are tracked in `supabase/migrations`. Use migrations for database changes; do not rely on dashboard-only edits.

## Request Flow

1. The browser talks to Next pages and client components.
2. Client code calls API routes under `frontend/app/api`.
3. API routes validate the user session, then read or write Supabase data.
4. File routes create signed URLs so private resources stay behind app rules.

## Shared Code

- `frontend/lib` holds reusable helpers for Supabase, search, enrollment, storage, moderation, and display logic.
- `frontend/app/components` holds shared app UI.
- Route-specific CSS stays beside its route when a page has enough styling to deserve its own file.
- `frontend/__tests__` holds focused Jest tests for helper behavior.

## Main Product Areas

- Browse courses and resources.
- Upload PDFs and generate previews.
- Award credits for approved uploads.
- Spend credits or free-download allowances for access.
- Vote, bookmark, report, and moderate resources.
- Track profile stats and leaderboard position.

## Boundaries

- Keep auth and credit logic server-side.
- Keep private files in Supabase Storage behind signed URLs.
- Keep database changes in migrations.
- Keep product copy consistent with `docs/brand.md`.
