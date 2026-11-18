alter table public.profiles
  add column if not exists is_admin boolean not null default false;

update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('joelkesis014@gmail.com');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, is_admin)
  values (new.id, lower(coalesce(new.email, '')) = lower('joelkesis014@gmail.com'));
  return new;
end
$$;

drop trigger if exists on_signup on auth.users;
create trigger on_signup
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin_user(account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = account_id), false)
$$;

revoke all on function public.is_admin_user(uuid) from public;
grant execute on function public.is_admin_user(uuid) to authenticated, service_role;

create or replace function public.admin_session_verified()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
    and exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) as amr(method)
      where coalesce(amr.method->>'method', trim(both '"' from amr.method::text)) = 'password'
    )
    and exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) as amr(method)
      where coalesce(amr.method->>'method', trim(both '"' from amr.method::text)) = 'totp'
    )
$$;

revoke all on function public.admin_session_verified() from public;
grant execute on function public.admin_session_verified() to authenticated, service_role;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
for select using (
  auth.uid() = id
  and (not public.is_admin_user(auth.uid()) or public.admin_session_verified())
);

drop policy if exists "own alerts" on public.alerts;
create policy "own alerts" on public.alerts
for select using (
  auth.uid() = user_id
  and (not public.is_admin_user(auth.uid()) or public.admin_session_verified())
);
