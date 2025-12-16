-- Create classes and notes tables to support dashboard filtering
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz default now()
);

create index if not exists idx_classes_user on public.classes(user_id);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  title text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

create index if not exists idx_notes_user on public.notes(user_id);
create index if not exists idx_notes_class on public.notes(class_id);
