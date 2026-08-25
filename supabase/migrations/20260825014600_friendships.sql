-- F2: mutual friend graph.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id)
);

-- One row per pair in either direction: rejects duplicate and
-- reverse-direction requests at the DB.
create unique index friendships_pair_idx on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- The only legal transition is pending -> accepted; accepted_at is stamped
-- server-side (clients can only write the status column — see grants).
create function public.friendship_accept()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    new.accepted_at := now();
    return new;
  end if;
  raise exception 'only pending -> accepted is allowed';
end;
$$;

create trigger friendships_accept
  before update on public.friendships
  for each row execute function public.friendship_accept();

alter table public.friendships enable row level security;

grant select, insert, delete on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;

create policy "participants read" on public.friendships
  for select using ((select auth.uid()) in (requester_id, addressee_id));
create policy "requester sends" on public.friendships
  for insert with check (
    (select auth.uid()) = requester_id
    and status = 'pending'
    and accepted_at is null
  );
create policy "addressee accepts" on public.friendships
  for update
  using ((select auth.uid()) = addressee_id and status = 'pending')
  with check ((select auth.uid()) = addressee_id and status = 'accepted');
-- decline (addressee), cancel (requester), and unfriend (either) are all the
-- same delete. Removing a friend revokes visibility immediately and deletes
-- no data.
create policy "participants delete" on public.friendships
  for delete using ((select auth.uid()) in (requester_id, addressee_id));

-- Shared by the entries / night_outs / storage read policies. security
-- invoker on purpose: the accepted row for (auth.uid(), other) is already
-- visible under this table's own RLS, so no escalation is needed.
create function public.is_friends_with(other uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = (select auth.uid()) and f.addressee_id = other)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = other))
  );
$$;

-- Any signed-in user can now read profiles: username lookup for requests,
-- the invite-link landing, and author display on feed/profile need it.
-- Trade-off (recorded in the F2 spec): username, user_code, avatar, and
-- timezone are visible to any authenticated user; anon still sees nothing.
drop policy "read own profile" on public.profiles;
create policy "authenticated read profiles" on public.profiles
  for select to authenticated using (true);
