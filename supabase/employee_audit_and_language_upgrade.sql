-- Run once in the Supabase SQL Editor.
-- Adds immutable employee numbers, profile audit history, and invitation language support.
begin;

create sequence if not exists public.employee_number_seq start with 1001;
alter table public.profiles add column if not exists employee_number bigint;

select setval(
  'public.employee_number_seq',
  greatest(coalesce((select max(employee_number) from public.profiles), 1000), 1000),
  true
);
update public.profiles
set employee_number = nextval('public.employee_number_seq')
where role = 'employee' and employee_number is null;
create unique index if not exists profiles_employee_number_unique
  on public.profiles(employee_number) where employee_number is not null;

create or replace function public.assign_and_protect_employee_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.employee_number is distinct from new.employee_number then
    raise exception 'Employee ID numbers cannot be changed';
  end if;
  if new.role = 'employee' and new.employee_number is null then
    new.employee_number := nextval('public.employee_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_employee_number_guard on public.profiles;
create trigger profiles_employee_number_guard
  before insert or update on public.profiles
  for each row execute function public.assign_and_protect_employee_number();

create table if not exists public.employee_profile_history (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  employee_number bigint not null,
  action text not null check (action in ('created', 'updated')),
  changed_fields text[] not null default '{}',
  old_values jsonb,
  new_values jsonb not null,
  modified_by uuid references public.profiles(id) on delete set null,
  modified_by_name text not null,
  modified_by_role text not null,
  changed_at timestamptz not null default now()
);
create index if not exists employee_profile_history_employee_date_idx
  on public.employee_profile_history(employee_id, changed_at desc);

alter table public.employee_profile_history enable row level security;
grant select on public.employee_profile_history to authenticated;
drop policy if exists "owner or employee reads profile audit" on public.employee_profile_history;
create policy "owner or employee reads profile audit" on public.employee_profile_history
for select to authenticated using (employee_id = auth.uid() or public.is_owner());

insert into public.employee_profile_history (
  employee_id, employee_number, action, changed_fields, old_values, new_values,
  modified_by, modified_by_name, modified_by_role
)
select p.id, p.employee_number, 'created', array['profile_created'], null, to_jsonb(p),
  null, 'System migration', 'system'
from public.profiles p
where p.role = 'employee'
  and not exists (select 1 from public.employee_profile_history h where h.employee_id = p.id);

create or replace function public.log_employee_profile_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
  actor_role text;
  fields text[];
begin
  if new.role <> 'employee' then return new; end if;
  if tg_op = 'UPDATE' and old is not distinct from new then return new; end if;
  select full_name, role::text into actor_name, actor_role
  from public.profiles where id = actor_id;
  actor_name := coalesce(actor_name, current_setting('request.jwt.claim.email', true), 'System');
  actor_role := coalesce(actor_role, 'system');

  if tg_op = 'INSERT' then
    fields := array['profile_created'];
  else
    select coalesce(array_agg(keys.key order by keys.key), '{}') into fields
    from (
      select coalesce(new_item.key, old_item.key) as key
      from jsonb_each(to_jsonb(new)) new_item
      full join jsonb_each(to_jsonb(old)) old_item using (key)
      where new_item.value is distinct from old_item.value
    ) keys;
  end if;

  insert into public.employee_profile_history (
    employee_id, employee_number, action, changed_fields, old_values, new_values,
    modified_by, modified_by_name, modified_by_role
  ) values (
    new.id, new.employee_number, case when tg_op = 'INSERT' then 'created' else 'updated' end,
    fields, case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new),
    actor_id, actor_name, actor_role
  );
  return new;
end;
$$;

drop trigger if exists employee_profile_audit on public.profiles;
create trigger employee_profile_audit
  after insert or update on public.profiles
  for each row
  execute function public.log_employee_profile_change();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invited_first_name text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  invited_last_name text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
  invited_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  invited_language text := case when new.raw_user_meta_data ->> 'preferred_language' = 'Español' then 'Español' else 'English' end;
begin
  insert into public.profiles (
    id, full_name, first_name, last_name, email, role, preferred_language, active, onboarding_complete
  ) values (
    new.id, coalesce(invited_full_name, nullif(trim(new.email), ''), new.id::text),
    invited_first_name, invited_last_name, lower(new.email), 'employee', invited_language, false, false
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop function if exists public.create_invited_employee_profile(uuid, text, text, text);
create or replace function public.create_invited_employee_profile(
  employee_id uuid, first_name_input text, last_name_input text, email_input text, language_input text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  selected_language text := case when language_input = 'Español' then 'Español' else 'English' end;
begin
  if not public.is_owner() then raise exception 'Only an owner can invite employees'; end if;
  insert into public.profiles (
    id, full_name, first_name, last_name, email, role, preferred_language, active, onboarding_complete
  ) values (
    employee_id, trim(first_name_input) || ' ' || trim(last_name_input),
    trim(first_name_input), trim(last_name_input), lower(trim(email_input)),
    'employee', selected_language, false, false
  ) on conflict (id) do update set
    full_name = excluded.full_name, first_name = excluded.first_name,
    last_name = excluded.last_name, email = excluded.email,
    role = 'employee', preferred_language = selected_language,
    active = false, onboarding_complete = false;
  return employee_id;
end;
$$;
revoke all on function public.create_invited_employee_profile(uuid, text, text, text, text) from public;
grant execute on function public.create_invited_employee_profile(uuid, text, text, text, text) to authenticated;

commit;
