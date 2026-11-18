create table if not exists payments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  checkout_id text unique, phone text, amount int, status text default 'pending',
  receipt text, created_at timestamptz default now());
alter table payments enable row level security;
drop policy if exists "own payments" on payments;
create policy "own payments" on payments for select using (
  auth.uid() = user_id
  and (not public.is_admin_user(auth.uid()) or public.admin_session_verified())
);
