-- F3: drink entries + photo storage.
create extension if not exists moddatetime with schema extensions;

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  drink_id bigint references public.drinks (id),
  custom_drink_name text,
  -- populated by trigger in both cases so unique-drink counting is always
  -- count(distinct coalesce(drink_id::text, normalized_drink_name))
  normalized_drink_name text not null,
  location text,
  photo_path text, -- storage object path in the 'photos' bucket
  note text check (char_length(note) <= 140),
  recommended boolean, -- null = no tag; true/false = the binary recommend tag
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((drink_id is null) <> (custom_drink_name is null)) -- exactly one source
);

create index entries_user_logged_idx on public.entries (user_id, logged_at desc);

-- Keeps normalized_drink_name in sync server-side; the client value is ignored.
-- Same normalization rule as web/lib/normalize.ts.
create function public.set_normalized_drink_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.drink_id is not null then
    select d.normalized_name into new.normalized_drink_name
      from public.drinks d where d.id = new.drink_id;
  else
    new.normalized_drink_name :=
      lower(regexp_replace(btrim(new.custom_drink_name), '\s+', ' ', 'g'));
  end if;
  return new;
end;
$$;

create trigger entries_normalized_drink_name
  before insert or update on public.entries
  for each row execute function public.set_normalized_drink_name();

create trigger entries_updated_at
  before update on public.entries
  for each row execute function extensions.moddatetime (updated_at);

alter table public.entries enable row level security;

-- Explicit grants (see drinks migration note). Also backfill profiles: F1
-- relied on hosted's permissive default ACLs, which the local stack (and
-- newer hosted projects) no longer provide; update stays column-scoped per
-- the profiles migration.
grant select, insert, update, delete on public.entries to authenticated;
grant select, insert on public.profiles to authenticated;

create policy "own entries select" on public.entries
  for select using ((select auth.uid()) = user_id);
create policy "own entries insert" on public.entries
  for insert with check ((select auth.uid()) = user_id);
create policy "own entries update" on public.entries
  for update using ((select auth.uid()) = user_id);
create policy "own entries delete" on public.entries
  for delete using ((select auth.uid()) = user_id);

-- Private photos bucket; object path is {user_id}/{entry_id}.jpg, so folder
-- ownership is the whole access rule. F5 widens read access to friends later.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false);

create policy "own photos select" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- update needed for photo replace (upload with upsert: true)
create policy "own photos update" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
