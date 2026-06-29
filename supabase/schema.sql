-- Desert Home Cleaning internal app
create type public.user_role as enum ('owner', 'employee');
create type public.block_status as enum ('open', 'claimed', 'completed', 'cancelled');
create type public.occupancy_status as enum ('vacant', 'occupied');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'employee',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.work_blocks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  city text not null,
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  occupancy public.occupancy_status not null,
  owners_present boolean,
  employee_pay numeric(8,2) not null check (employee_pay > 0),
  tasks text[] not null default '{}',
  status public.block_status not null default 'open',
  claimed_by uuid references public.profiles(id),
  claimed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint owners_presence_consistent check (
    (occupancy = 'vacant' and owners_present is null)
    or (occupancy = 'occupied' and owners_present is not null)
  ),
  constraint claim_state_consistent check (
    (status = 'open' and claimed_by is null and claimed_at is null) or status <> 'open'
  )
);

-- Kept separate so an employee cannot retrieve the exact location before claiming.
create table public.work_block_private_details (
  work_block_id uuid primary key references public.work_blocks(id) on delete cascade,
  address text not null,
  private_notes text,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.work_blocks enable row level security;
alter table public.work_block_private_details enable row level security;
alter table public.push_subscriptions enable row level security;

create function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and active
  );
$$;

create policy "team can read active profiles" on public.profiles
  for select to authenticated using (active);
create policy "owner manages profiles" on public.profiles
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "team reads work blocks" on public.work_blocks
  for select to authenticated using (
    public.is_owner() or status = 'open' or claimed_by = auth.uid()
  );
create policy "owner creates work" on public.work_blocks
  for insert to authenticated with check (public.is_owner() and created_by = auth.uid());
create policy "owner updates work" on public.work_blocks
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "owner manages private work details" on public.work_block_private_details
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "assigned employee reads private work details" on public.work_block_private_details
  for select to authenticated using (
    exists (
      select 1 from public.work_blocks
      where public.work_blocks.id = public.work_block_private_details.work_block_id
        and claimed_by = auth.uid()
        and status in ('claimed', 'completed')
    )
  );
create policy "users manage own push subscription" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Exactly one simultaneous caller can change an open row. Every later caller receives
-- no row and therefore `claimed = false`.
create or replace function public.claim_work_block(block_id uuid)
returns table (claimed boolean, work_block_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare won_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'employee' and active
  ) then
    raise exception 'Only active employees can claim work';
  end if;

  update public.work_blocks
  set status = 'claimed', claimed_by = auth.uid(), claimed_at = now()
  where id = block_id and status = 'open' and claimed_by is null
  returning id into won_id;

  return query select won_id is not null, won_id;
end;
$$;

revoke all on function public.claim_work_block(uuid) from public;
grant execute on function public.claim_work_block(uuid) to authenticated;

-- Owner-only reversal: removes the current employee and returns the block to the team.
create or replace function public.unassign_work_block(block_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare affected_rows integer;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can remove an assignment';
  end if;

  update public.work_blocks
  set status = 'open', claimed_by = null, claimed_at = null
  where id = block_id and status = 'claimed' and claimed_by is not null;

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function public.unassign_work_block(uuid) from public;
grant execute on function public.unassign_work_block(uuid) to authenticated;
