-- Allow each signed-in team member to update only their own contact details.
create or replace function public.update_own_profile(
  first_name_input text,
  last_name_input text,
  email_input text,
  phone_input text,
  address_input text,
  language_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(first_name_input), '') is null or nullif(trim(last_name_input), '') is null then
    raise exception 'First and last name are required';
  end if;

  update public.profiles
  set first_name = trim(first_name_input),
      last_name = trim(last_name_input),
      full_name = trim(first_name_input) || ' ' || trim(last_name_input),
      email = lower(nullif(trim(email_input), '')),
      phone = nullif(trim(phone_input), ''),
      address = nullif(trim(address_input), ''),
      preferred_language = case when language_input in ('English', 'Español') then language_input else 'English' end
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function public.update_own_profile(text, text, text, text, text, text) from public;
grant execute on function public.update_own_profile(text, text, text, text, text, text) to authenticated;
