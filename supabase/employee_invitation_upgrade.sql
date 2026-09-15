-- Run once in the Supabase SQL Editor before sending employee invitations.
begin;
alter table public.profiles add column if not exists email text, add column if not exists address text;
grant select, insert, update on table public.profiles to service_role;
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
