# Supabase Setup

Supabase provides auth, Postgres, and private file storage for Poly Pages.

## Prerequisites

- Supabase CLI.
- Access to the hosted Supabase project.
- Values for `frontend/.env.local`.

## Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Keep service-role keys out of client code and out of git.

## Link The Project

```bash
supabase login
supabase link --project-ref prwaxvxppcbnoqwcvcjn
```

## Apply Migrations

```bash
supabase db push
```

Migrations live in `supabase/migrations`. Add a new migration for schema changes instead of editing the hosted database by hand.

## Seed Catalog Data

Run from the repo root after env vars are set:

```bash
npm --prefix frontend run db:seed-departments
npm --prefix frontend run db:seed-catalog
```

The seed scripts populate department aliases, courses, course numbers, and catalog terms used by search and browse flows.
`db:seed-catalog` writes the app's default `2526` catalog year and uses the same
catalog-year conflict key as the current migrations.

## Storage

The app expects private buckets for:

- `resources`: original uploaded PDFs.
- `previews`: generated preview images.

API routes create signed URLs when a user is allowed to view or download a file.

## Useful Commands

```bash
supabase status
supabase db lint
supabase db pull
supabase db dump --schema public
```
