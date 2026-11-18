create table profiles (
  id uuid primary key references auth.users on delete cascade,
  trial_ends_at timestamptz, subscription_expires_at timestamptz,
  connected boolean default false, created_at timestamptz default now());
create table alerts (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  subject text, delivered boolean default false, created_at timestamptz default now());
-- Encrypted credentials live in a table with NO select policy, so only the backend (service role) can read it.
create table credentials (
  user_id uuid primary key references auth.users on delete cascade,
  gmail text, app_password_enc text, bot_token_enc text, chat_id text,
  gmail_hash text unique, chat_hash text unique);
alter table profiles enable row level security; alter table alerts enable row level security; alter table credentials enable row level security;
create policy "own profile" on profiles for select using (auth.uid() = id);
create policy "own alerts" on alerts for select using (auth.uid() = user_id);
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin insert into public.profiles (id) values (new.id); return new; end $$;
create trigger on_signup after insert on auth.users for each row execute function handle_new_user();
