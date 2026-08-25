-- F5 + F7: friend-visible reads and the feed/profile query functions.
--
-- RLS answers "may I see it" (a friend's FULL history — F7 needs that);
-- the feed's no-backfill rule is a query concern, applied in feed_entries().

drop policy "own entries select" on public.entries;
create policy "own or friends entries select" on public.entries
  for select using (
    (select auth.uid()) = user_id or public.is_friends_with(user_id)
  );

-- Photos follow the same rule: the folder owner or their friends. Paths in
-- the photos bucket are always {user_id}/..., so the folder name cast is safe.
drop policy "own photos select" on storage.objects;
create policy "own or friends photos select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_friends_with(((storage.foldername(name))[1])::uuid)
    )
  );

-- The feed: own entries, friend entries posted after acceptance, and exactly
-- one pre-acceptance entry per friend (their most recent). created_at, not
-- logged_at, decides pre/post: logged_at is user-editable backdating.
-- security invoker, so entries/friendships RLS still applies — the friends
-- CTE only sees the caller's own friendship rows.
create function public.feed_entries(
  before_logged_at timestamptz default 'infinity',
  before_id uuid default 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  lim int default 30
)
returns table (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  drink_name text,
  night_out_id uuid,
  night_out_name text,
  location text,
  photo_path text,
  note text,
  recommended boolean,
  logged_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  with friends as (
    select case when f.requester_id = (select auth.uid()) then f.addressee_id
                else f.requester_id end as friend_id,
           f.accepted_at
    from public.friendships f
    where f.status = 'accepted'
  ),
  visible as (
    select e.* from public.entries e where e.user_id = (select auth.uid())
    union all
    select e.* from friends fr
      join public.entries e
        on e.user_id = fr.friend_id and e.created_at >= fr.accepted_at
    union all
    select le.* from friends fr
      cross join lateral (
        select e.* from public.entries e
        where e.user_id = fr.friend_id and e.created_at < fr.accepted_at
        -- logged_at has minute precision from the form, so ties are common;
        -- created_at breaks them with actual posting order
        order by e.logged_at desc, e.created_at desc, e.id desc
        limit 1
      ) le
  )
  select v.id, v.user_id, p.username, p.avatar_url,
         coalesce(d.name, v.custom_drink_name) as drink_name,
         v.night_out_id, n.name as night_out_name,
         v.location, v.photo_path, v.note, v.recommended, v.logged_at
  from visible v
  join public.profiles p on p.id = v.user_id
  left join public.drinks d on d.id = v.drink_id
  left join public.night_outs n on n.id = v.night_out_id
  where (v.logged_at, v.id) < (before_logged_at, before_id)
  order by v.logged_at desc, v.id desc
  limit lim;
$$;

-- Profile counts, computed under the caller's RLS: a non-friend gets zeros.
-- nights_out is the label-independent metric: distinct 4am-to-4am windows in
-- the profile owner's timezone (MVP doc section 3).
create function public.profile_stats(profile_id uuid)
returns table (total_entries bigint, unique_drinks bigint, nights_out bigint)
language sql
stable
set search_path = ''
as $$
  select count(*),
         count(distinct coalesce(e.drink_id::text, e.normalized_drink_name)),
         count(distinct ((e.logged_at at time zone p.timezone - interval '4 hours')::date))
  from public.entries e
  join public.profiles p on p.id = e.user_id
  where e.user_id = profile_id;
$$;

revoke all on function public.feed_entries from public, anon;
grant execute on function public.feed_entries to authenticated;
revoke all on function public.profile_stats from public, anon;
grant execute on function public.profile_stats to authenticated;
