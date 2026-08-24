-- F1: user profiles, one row per auth user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- immutable code for links and internal references; unique constraint guards collisions
  user_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  timezone text not null,
  age_attested_at timestamptz not null,
  leaderboard_opt_in boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select using ((select auth.uid()) = id);

create policy "insert own profile" on public.profiles
  for insert with check ((select auth.uid()) = id);

create policy "update own profile" on public.profiles
  for update using ((select auth.uid()) = id);

-- user_code and age_attested_at are immutable: column-level grants keep them
-- out of reach of client updates entirely.
revoke update on public.profiles from anon, authenticated;
grant update (username, timezone, avatar_url, leaderboard_opt_in)
  on public.profiles to authenticated;

-- Account deletion purges everything. The auth.users delete cascades to
-- profiles (and later tables). security definer because authenticated users
-- cannot touch auth.users directly.
create function public.delete_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
