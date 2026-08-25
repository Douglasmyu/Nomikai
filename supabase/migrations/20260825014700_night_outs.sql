-- F12: night out sessions — personal labels entries can group under.
create table public.night_outs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  location text,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- target of the composite FK from entries
  unique (id, user_id)
);

create index night_outs_user_started_idx on public.night_outs (user_id, started_at desc);

-- Composite FK: an entry can only point at its own user's night out, so a
-- client cannot attach entries to a friend's session. Deleting a night out
-- ungroups its entries (set null on night_out_id only); it never deletes them.
alter table public.entries
  add column night_out_id uuid,
  add constraint entries_night_out_fk
    foreign key (night_out_id, user_id)
    references public.night_outs (id, user_id)
    on delete set null (night_out_id);

alter table public.night_outs enable row level security;

grant select, insert, update, delete on public.night_outs to authenticated;

-- Friends resolve the label on feed and profile rows; DML stays own-only.
create policy "own or friends night outs select" on public.night_outs
  for select using (
    (select auth.uid()) = user_id or public.is_friends_with(user_id)
  );
create policy "own night outs insert" on public.night_outs
  for insert with check ((select auth.uid()) = user_id);
create policy "own night outs update" on public.night_outs
  for update using ((select auth.uid()) = user_id);
create policy "own night outs delete" on public.night_outs
  for delete using ((select auth.uid()) = user_id);
