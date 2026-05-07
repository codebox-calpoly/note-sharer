-- Add catalog_year to courses to distinguish academic year catalogs.
-- 2526 = 2025-2026 catalog, 2627 = 2026-2027 catalog, etc.
-- Existing courses were seeded from the 2026-2027 catalog, so default them to 2627.

alter table public.courses
  add column if not exists catalog_year smallint not null default 2627;

-- Update existing rows explicitly (in case default doesn't apply retroactively)
update public.courses set catalog_year = 2627 where catalog_year = 2627;

-- Index for fast filtering by catalog year
create index if not exists idx_courses_catalog_year on public.courses (catalog_year);

-- Update the unique constraint to include catalog_year so the same course can exist
-- in both catalogs without conflict.
alter table public.courses
  drop constraint if exists courses_department_course_number_term_year_key;

alter table public.courses
  drop constraint if exists courses_dept_num_term_year_catalog_key;

alter table public.courses
  add constraint courses_dept_num_term_year_catalog_key
  unique (department, course_number, term, year, catalog_year);

