-- Desert Home Cleaning internal app
create type public.user_role as enum ('owner', 'employee');
create type public.block_status as enum ('open', 'claimed', 'completed', 'cancelled');
create type public.occupancy_status as enum ('vacant', 'occupied');
create type public.payment_method as enum ('zelle', 'ach', 'check', 'other');
create type public.employee_standing as enum ('new', 'good', 'watch', 'risk');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'employee',
  preferred_language text check (preferred_language in ('English', 'Español')),
  phone text,
  payment_method public.payment_method,
  payment_contact text,
  service_area text,
  emergency_contact text,
  onboarding_complete boolean not null default false,
  standing public.employee_standing not null default 'new',
  performance_score integer check (performance_score between 0 and 100),
  standing_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint new_employee_score_consistent check (
    (standing = 'new' and performance_score is null) or standing <> 'new'
  )
);

create table public.work_blocks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  city text not null,
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  square_feet integer not null check (square_feet > 0),
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
  access_codes text,
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

create table public.owner_notifications (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  work_block_id uuid not null references public.work_blocks(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- A Database Webhook on INSERT sends these rows to the send-claim-email Edge Function.
create table public.email_outbox (
  id bigint generated always as identity primary key,
  work_block_id uuid not null references public.work_blocks(id) on delete cascade,
  recipient text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.employee_payments (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  work_block_id uuid references public.work_blocks(id) on delete set null,
  amount numeric(8,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.work_blocks enable row level security;
alter table public.work_block_private_details enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.owner_notifications enable row level security;
alter table public.email_outbox enable row level security;
alter table public.employee_payments enable row level security;

create function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and active
  );
$$;

create policy "owner or self reads profile" on public.profiles
  for select to authenticated using (public.is_owner() or id = auth.uid());
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
create policy "owner reads own notifications" on public.owner_notifications
  for select to authenticated using (owner_id = auth.uid() and public.is_owner());
create policy "owner reads email outbox" on public.email_outbox
  for select to authenticated using (public.is_owner());
create policy "owner manages employee payments" on public.employee_payments
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "employee reads own payments" on public.employee_payments
  for select to authenticated using (employee_id = auth.uid());

-- Registration stores only a payout preference/contact. Raw ACH account and routing
-- numbers must be tokenized by a payment provider and never passed to this function.
create or replace function public.register_employee(
  full_name_input text,
  language_input text,
  phone_input text,
  payment_method_input public.payment_method,
  payment_contact_input text,
  service_area_input text default null,
  emergency_contact_input text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if language_input not in ('English', 'Español') then raise exception 'Unsupported language'; end if;

  insert into public.profiles (
    id, full_name, role, preferred_language, phone, payment_method, payment_contact,
    service_area, emergency_contact, onboarding_complete
  ) values (
    auth.uid(), trim(full_name_input), 'employee', language_input, trim(phone_input),
    payment_method_input, trim(payment_contact_input), nullif(trim(service_area_input), ''),
    nullif(trim(emergency_contact_input), ''), true
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    preferred_language = excluded.preferred_language,
    phone = excluded.phone,
    payment_method = excluded.payment_method,
    payment_contact = excluded.payment_contact,
    service_area = excluded.service_area,
    emergency_contact = excluded.emergency_contact,
    onboarding_complete = true;

  return auth.uid();
end;
$$;

revoke all on function public.register_employee(text, text, text, public.payment_method, text, text, text) from public;
grant execute on function public.register_employee(text, text, text, public.payment_method, text, text, text) to authenticated;

create view public.employee_payment_totals
with (security_invoker = true)
as
select
  employee_id,
  coalesce(sum(amount) filter (
    where paid_at >= date_trunc('month', now())
  ), 0) as paid_this_month,
  coalesce(sum(amount) filter (
    where paid_at >= date_trunc('year', now())
  ), 0) as paid_this_year,
  coalesce(sum(amount), 0) as paid_lifetime
from public.employee_payments
group by employee_id;

-- Exactly one simultaneous caller can change an open row. Every later caller receives
-- no row and therefore `claimed = false`.
create or replace function public.claim_work_block(block_id uuid)
returns table (claimed boolean, work_block_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  won_id uuid;
  block_title text;
  employee_name text;
  owner_message text;
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

  if won_id is not null then
    select title into block_title from public.work_blocks where id = won_id;
    select full_name into employee_name from public.profiles where id = auth.uid();
    owner_message := employee_name || ' accepted ' || block_title || '.';

    insert into public.owner_notifications (owner_id, work_block_id, message)
    select id, won_id, owner_message
    from public.profiles
    where role = 'owner' and active;

    insert into public.email_outbox (work_block_id, recipient, subject, body)
    values (
      won_id,
      'raarentalsllc@gmail.com',
      'Cleaning work accepted: ' || block_title,
      owner_message || ' Open the owner dashboard for the full assignment details.'
    );
  end if;

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
