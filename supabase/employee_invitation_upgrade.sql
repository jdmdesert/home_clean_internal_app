-- Run once in the Supabase SQL Editor before sending employee invitations.
begin;
alter table public.profiles add column if not exists email text, add column if not exists address text;
grant select, insert, update on table public.profiles to service_role;

-- Supabase Auth invitations insert into auth.users first. Keep the automatic
-- profile creation compatible with pending employee accounts.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invited_first_name text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  invited_last_name text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
  invited_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
begin
  insert into public.profiles (
    id, full_name, first_name, last_name, email, role, active, onboarding_complete
  ) values (
    new.id,
    coalesce(invited_full_name, nullif(trim(new.email), ''), new.id::text),
    invited_first_name,
    invited_last_name,
    lower(new.email),
    'employee', false, false
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_invited_employee_profile(
  employee_id uuid, first_name_input text, last_name_input text, email_input text
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'Only an owner can invite employees'; end if;
  insert into public.profiles (
    id, full_name, first_name, last_name, email, role, active, onboarding_complete
  ) values (
    employee_id, trim(first_name_input) || ' ' || trim(last_name_input),
    trim(first_name_input), trim(last_name_input), lower(trim(email_input)),
    'employee', false, false
  ) on conflict (id) do update set
    full_name = excluded.full_name, first_name = excluded.first_name,
    last_name = excluded.last_name, email = excluded.email,
    role = 'employee', active = false, onboarding_complete = false;
  return employee_id;
end;
$$;
revoke all on function public.create_invited_employee_profile(uuid, text, text, text) from public;
grant execute on function public.create_invited_employee_profile(uuid, text, text, text) to authenticated;
drop function if exists public.register_employee(text, text, date, text, text, public.payment_method, text, text, text);

create or replace function public.register_employee(
  first_name_input text, last_name_input text, date_of_birth_input date,
  language_input text, phone_input text, address_input text,
  payment_method_input public.payment_method, payment_contact_input text,
  service_area_input text default null, emergency_contact_input text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if language_input not in ('English', 'Español') then raise exception 'Unsupported language'; end if;
  if date_of_birth_input > current_date then raise exception 'Date of birth cannot be in the future'; end if;
  update public.profiles set
    full_name = trim(first_name_input) || ' ' || trim(last_name_input), first_name = trim(first_name_input),
    last_name = trim(last_name_input), date_of_birth = date_of_birth_input, role = 'employee',
    preferred_language = language_input, phone = trim(phone_input), address = trim(address_input),
    payment_method = payment_method_input, payment_contact = trim(payment_contact_input),
    service_area = nullif(trim(service_area_input), ''), emergency_contact = nullif(trim(emergency_contact_input), ''),
    onboarding_complete = true, active = true
  where id = auth.uid() and role = 'employee';
  if not found then raise exception 'Employee invitation profile not found'; end if;
  return auth.uid();
end;
$$;
revoke all on function public.register_employee(text, text, date, text, text, text, public.payment_method, text, text, text) from public;
grant execute on function public.register_employee(text, text, date, text, text, text, public.payment_method, text, text, text) to authenticated;
commit;
