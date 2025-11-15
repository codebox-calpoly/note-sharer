-- Note Sharer base schema derived from PRD + Tech Stack (Nov 10, 2025)
-- Applies to Supabase project: prwaxvxppcbnoqwcvcjn

set check_function_bodies = off;

create extension if not exists "pgcrypto" with schema public;
create extension if not exists "pg_trgm" with schema public;
create extension if not exists "citext" with schema public;

-- Custom enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role_type') then
    create type public.user_role_type as enum ('student','moderator','teacher','ta','admin','developer');
  end if;
  if not exists (select 1 from pg_type where typname = 'resource_status') then
    create type public.resource_status as enum ('pending','active','flagged','removed','archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_category') then
    create type public.report_category as enum ('ip','cheating','abuse','spam','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('open','reviewing','resolved','rejected');
  end if;
end $$;

-- Helper to keep updated_at fresh
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  handle citext not null unique check (handle ~* '^[a-z0-9_]{3,32}$'),
  display_name text,
  campus_email text unique,
  bio text,
  avatar_url text,
  is_handle_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row execute function public.fn_touch_updated_at();

create table if not exists public.user_roles (
  profile_id uuid not null references public.profiles on delete cascade,
  role public.user_role_type not null,
  granted_by uuid references public.profiles on delete set null,
  granted_at timestamptz not null default now(),
  note text,
  primary key (profile_id, role)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  course_number text not null,
  title text not null,
  term text not null,
  year smallint not null,
  description text,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department, course_number, term, year)
);

create trigger trg_courses_touch_updated_at
before update on public.courses
for each row execute function public.fn_touch_updated_at();

create table if not exists public.course_submissions (
  id bigserial primary key,
  submitter_id uuid references public.profiles on delete set null,
  department text not null,
  course_number text not null,
  title text,
  term text,
  year smallint,
  justification text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id uuid references public.profiles on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  title text not null,
  description text,
  tags text[] not null default '{}',
  week_label text,
  topic text,
  file_key text not null,
  preview_key text not null,
  phash text,
  ai_metadata jsonb not null default '{}'::jsonb,
  download_cost smallint not null default 3 check (download_cost >= 0),
  status public.resource_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_file_key_unique unique (file_key)
);

create trigger trg_resources_touch_updated_at
before update on public.resources
for each row execute function public.fn_touch_updated_at();

create index if not exists idx_resources_course on public.resources(course_id);
create index if not exists idx_resources_profile on public.resources(profile_id);
create index if not exists idx_resources_tags on public.resources using gin(tags);
create index if not exists idx_resources_fts on public.resources using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));

create table if not exists public.votes (
  id bigserial primary key,
  resource_id uuid not null references public.resources on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (resource_id, profile_id)
);

create index if not exists idx_votes_profile on public.votes(profile_id);

create table if not exists public.credits_ledger (
  id bigserial primary key,
  profile_id uuid not null references public.profiles on delete cascade,
  resource_id uuid references public.resources on delete set null,
  source text not null,
  amount integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_credits_profile on public.credits_ledger(profile_id);

create view public.credit_balances as
  select profile_id, coalesce(sum(amount), 0) as credits
  from public.credits_ledger
  group by profile_id;

create table if not exists public.download_vouchers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles on delete cascade,
  source text not null default 'signup_bonus',
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_vouchers_profile on public.download_vouchers(profile_id);

create table if not exists public.resource_downloads (
  id bigserial primary key,
  resource_id uuid not null references public.resources on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  voucher_id uuid references public.download_vouchers on delete set null,
  credits_spent integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_resource_downloads_profile on public.resource_downloads(profile_id);

create table if not exists public.reports (
  id bigserial primary key,
  resource_id uuid not null references public.resources on delete cascade,
  reporter_id uuid not null references public.profiles on delete cascade,
  category public.report_category not null,
  notes text,
  weight smallint not null default 1,
  status public.report_status not null default 'open',
  moderator_id uuid references public.profiles on delete set null,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_resource on public.reports(resource_id);

create table if not exists public.moderation_actions (
  id bigserial primary key,
  resource_id uuid not null references public.resources on delete cascade,
  moderator_id uuid not null references public.profiles on delete cascade,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Views to expose aggregate voting info
create or replace view public.resource_vote_stats as
  select
    resource_id,
    sum(case when value = 1 then 1 else 0 end) as upvotes,
    sum(case when value = -1 then 1 else 0 end) as downvotes,
    coalesce(sum(value), 0) as score
  from public.votes
  group by resource_id;

-- RPC: award upload credits (+5, idempotent per resource)
create or replace function public.rpc_award_upload_credits(p_resource_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_exists boolean;
begin
  select profile_id into v_profile_id from public.resources where id = p_resource_id;
  if v_profile_id is null then
    raise exception 'Resource % not found', p_resource_id;
  end if;

  select exists (
    select 1 from public.credits_ledger
    where resource_id = p_resource_id and source = 'upload_reward'
  ) into v_exists;

  if v_exists then
    return;
  end if;

  insert into public.credits_ledger (profile_id, resource_id, source, amount, metadata)
  values (v_profile_id, p_resource_id, 'upload_reward', 5, jsonb_build_object('reason','upload_reward'));
end;
$$;

-- RPC: consumes vouchers before credits, logs download + deduction
create or replace function public.rpc_consume_download(
  p_resource_id uuid,
  p_profile_id uuid
)
returns table (
  download_id bigint,
  used_voucher boolean,
  credits_charged integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost integer;
  v_balance integer;
  v_voucher uuid;
begin
  select download_cost into v_cost from public.resources where id = p_resource_id and status = 'active';
  if v_cost is null then
    raise exception 'Resource % not available for download', p_resource_id;
  end if;

  -- Try voucher first
  select id into v_voucher
  from public.download_vouchers
  where profile_id = p_profile_id
    and redeemed_at is null
    and (expires_at is null or expires_at > now())
  order by created_at
  limit 1;

  if v_voucher is not null then
    update public.download_vouchers
      set redeemed_at = now()
      where id = v_voucher;

    insert into public.resource_downloads (resource_id, profile_id, voucher_id, credits_spent)
    values (p_resource_id, p_profile_id, v_voucher, 0)
    returning id into download_id;

    return query select download_id, true, 0;
    return;
  end if;

  -- otherwise deduct credits
  select coalesce(sum(amount), 0) into v_balance
  from public.credits_ledger
  where profile_id = p_profile_id;

  if v_balance < v_cost then
    raise exception 'Insufficient credits: have %, need %', v_balance, v_cost;
  end if;

  insert into public.credits_ledger (profile_id, resource_id, source, amount, metadata)
  values (p_profile_id, p_resource_id, 'download', v_cost * -1, jsonb_build_object('reason','download'));

  insert into public.resource_downloads (resource_id, profile_id, credits_spent)
  values (p_resource_id, p_profile_id, v_cost)
  returning id into download_id;

  return query select download_id, false, v_cost;
end;
$$;

-- Voting trigger to keep credit cap per resource
create or replace function public.fn_handle_vote_credits()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
  v_upvotes integer;
begin
  if tg_op = 'INSERT' and new.value = 1 then
    select profile_id into v_owner from public.resources where id = new.resource_id;
    if v_owner is null then
      return new;
    end if;

    select count(*) into v_upvotes
    from public.votes
    where resource_id = new.resource_id and value = 1;

    if v_upvotes <= 10 then
      insert into public.credits_ledger (profile_id, resource_id, source, amount, metadata)
      values (v_owner, new.resource_id, 'upvote_bonus', 1, jsonb_build_object('vote_id', new.id));
    end if;
  end if;

  if tg_op = 'DELETE' and old.value = 1 then
    insert into public.credits_ledger (profile_id, resource_id, source, amount, metadata)
    values (
      (select profile_id from public.resources where id = old.resource_id),
      old.resource_id,
      'upvote_bonus_reversal',
      -1,
      jsonb_build_object('vote_id', old.id)
    );
  end if;

  return new;
end;
$$;

create trigger trg_vote_credit_cap
after insert or delete on public.votes
for each row execute function public.fn_handle_vote_credits();

-- RLS configuration
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.courses enable row level security;
alter table public.course_submissions enable row level security;
alter table public.resources enable row level security;
alter table public.votes enable row level security;
alter table public.credits_ledger enable row level security;
alter table public.download_vouchers enable row level security;
alter table public.resource_downloads enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;

-- Baseline policies (adjust in app code as needed)
create policy "Profiles are readable" on public.profiles
for select
using (true);

create policy "Users manage their profile" on public.profiles
for update using (auth.uid() = id);

create policy "Insert own profile row" on public.profiles
for insert with check (auth.uid() = id);

create policy "Courses readable" on public.courses
for select using (true);

create policy "Course submissions by owner" on public.course_submissions
for select using (auth.uid() = submitter_id or exists (
  select 1 from public.user_roles
  where user_roles.profile_id = auth.uid() and user_roles.role in ('admin','moderator','teacher','ta')
));

create policy "Insert course submission" on public.course_submissions
for insert with check (auth.uid() = submitter_id);

create policy "Resources readable" on public.resources
for select using (
  status in ('active','pending')
);

create policy "Owners manage resources" on public.resources
for insert with check (auth.uid() = profile_id);

create policy "Owners update resources" on public.resources
for update using (auth.uid() = profile_id);

create policy "Votes readable" on public.votes
for select using (true);

create policy "Users upsert own vote" on public.votes
for insert with check (auth.uid() = profile_id);

create policy "Users update own vote" on public.votes
for update using (auth.uid() = profile_id);

create policy "Ledger visible to owner" on public.credits_ledger
for select using (auth.uid() = profile_id);

create policy "Ledger entries insertable by owner" on public.credits_ledger
for insert with check (auth.uid() = profile_id);

create policy "Vouchers visible to owner" on public.download_vouchers
for select using (auth.uid() = profile_id);

create policy "Downloads visible to owner" on public.resource_downloads
for select using (auth.uid() = profile_id);

create policy "Reports readable for mods" on public.reports
for select using (
  auth.uid() = reporter_id or exists (
    select 1 from public.user_roles
    where profile_id = auth.uid() and role in ('admin','moderator','teacher','ta')
  )
);

create policy "Create reports as reporter" on public.reports
for insert with check (auth.uid() = reporter_id);

create policy "Moderation actions by staff" on public.moderation_actions
for insert with check (
  exists (
    select 1 from public.user_roles
    where profile_id = auth.uid() and role in ('admin','moderator','teacher','ta')
  )
);
