-- Add moderation controls for blocked users and flash credit promotions.

alter table public.profiles
add column if not exists blocked_at timestamptz,
add column if not exists blocked_by uuid references public.profiles on delete set null,
add column if not exists block_reason text;

create index if not exists idx_profiles_blocked_at
  on public.profiles(blocked_at)
  where blocked_at is not null;

create table if not exists public.user_moderation_actions (
  id bigserial primary key,
  target_profile_id uuid not null references public.profiles on delete cascade,
  moderator_id uuid not null references public.profiles on delete cascade,
  action text not null check (action in ('block','unblock')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_moderation_actions_target
  on public.user_moderation_actions(target_profile_id, created_at desc);

create table if not exists public.credit_promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  multiplier numeric(4,2) not null default 2.00 check (multiplier >= 1 and multiplier <= 5),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  reason text,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  constraint credit_promotions_valid_window check (ends_at > starts_at)
);

create index if not exists idx_credit_promotions_active_window
  on public.credit_promotions(starts_at, ends_at)
  where ended_at is null;

alter table public.user_moderation_actions enable row level security;
alter table public.credit_promotions enable row level security;

drop policy if exists "User moderation actions readable by staff" on public.user_moderation_actions;
create policy "User moderation actions readable by staff" on public.user_moderation_actions
for select using (
  exists (
    select 1 from public.user_roles
    where profile_id = auth.uid() and role in ('admin','moderator','teacher','ta','developer')
  )
);

drop policy if exists "Credit promotions readable by authenticated users" on public.credit_promotions;
create policy "Credit promotions readable by authenticated users" on public.credit_promotions
for select using (auth.uid() is not null);

create or replace function public.fn_current_credit_promotion()
returns table (
  promotion_id uuid,
  multiplier numeric
)
language sql
stable
set search_path = public
as $$
  select id, multiplier
  from public.credit_promotions
  where ended_at is null
    and starts_at <= now()
    and ends_at > now()
  order by multiplier desc, ends_at desc
  limit 1
$$;

create or replace function public.rpc_grant_upload_reward(
  p_profile_id uuid,
  p_resource_id uuid,
  p_amount integer default 5
)
returns table (
  granted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status public.resource_status;
  v_inserted boolean := false;
  v_promotion_id uuid;
  v_multiplier numeric := 1;
  v_award_amount integer;
begin
  if p_amount <= 0 then
    raise exception 'p_amount must be positive';
  end if;

  select profile_id, status into v_owner, v_status
  from public.resources
  where id = p_resource_id;

  if v_owner is null then
    raise exception 'Resource % not found', p_resource_id;
  end if;

  if v_owner <> p_profile_id then
    raise exception 'Resource owner mismatch for %', p_resource_id;
  end if;

  if v_status <> 'active' then
    raise exception 'Resource % is not active', p_resource_id;
  end if;

  select promotion_id, multiplier
  into v_promotion_id, v_multiplier
  from public.fn_current_credit_promotion();

  v_multiplier := coalesce(v_multiplier, 1);
  v_award_amount := greatest(1, ceil(p_amount * v_multiplier)::integer);

  begin
    insert into public.credits_ledger (profile_id, resource_id, source, amount, metadata)
    values (
      p_profile_id,
      p_resource_id,
      'upload_reward',
      v_award_amount,
      jsonb_build_object(
        'reason', 'upload_reward',
        'base_amount', p_amount,
        'promotion_id', v_promotion_id,
        'promotion_multiplier', v_multiplier
      )
    );
    v_inserted := true;
  exception
    when unique_violation then
      v_inserted := false;
  end;

  if v_inserted then
    update public.profiles
    set credit_score = coalesce(credit_score, 0) + v_award_amount
    where id = p_profile_id;
  end if;

  return query select v_inserted;
end;
$$;

create or replace function public.fn_handle_vote_credits()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
  v_awarded integer;
  v_remaining integer;
  v_grant integer;
  v_promotion_id uuid;
  v_multiplier numeric := 1;
  v_unit_award integer;
  v_cap integer;
begin
  if tg_op = 'INSERT' and new.value = 1 then
    select profile_id into v_owner from public.resources where id = new.resource_id;
    if v_owner is null then
      return new;
    end if;

    select promotion_id, multiplier
    into v_promotion_id, v_multiplier
    from public.fn_current_credit_promotion();

    v_multiplier := coalesce(v_multiplier, 1);
    v_unit_award := greatest(1, ceil(3 * v_multiplier)::integer);
    v_cap := greatest(10, ceil(10 * v_multiplier)::integer);

    select coalesce(sum(amount), 0) into v_awarded
    from public.credits_ledger
    where resource_id = new.resource_id
      and source = 'upvote_bonus';

    v_remaining := v_cap - v_awarded;
    if v_remaining > 0 then
      v_grant := least(v_unit_award, v_remaining);
      insert into public.credits_ledger (profile_id, resource_id, source, amount, metadata)
      values (
        v_owner,
        new.resource_id,
        'upvote_bonus',
        v_grant,
        jsonb_build_object(
          'vote_id', new.id,
          'base_amount', 3,
          'base_cap', 10,
          'promotion_id', v_promotion_id,
          'promotion_multiplier', v_multiplier
        )
      );

      update public.profiles
      set credit_score = coalesce(credit_score, 0) + v_grant
      where id = v_owner;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.fn_current_credit_promotion() from public;
grant execute on function public.fn_current_credit_promotion() to authenticated;
grant execute on function public.fn_current_credit_promotion() to service_role;
