-- The API replaced these three. It connects as `postgres`, so it never sees
-- auth.uid() — every one of them was built around it, and all three are now
-- dead: nothing in the repo calls them, and no policy, function, or view
-- depends on them.
--
--   feed_entries()   -> GET /feed          (api/src/feed.controller.ts)
--                       Same SQL, but the viewer id is bound as a parameter,
--                       and the friends CTE gained an explicit participant
--                       filter — it used to rely on friendships RLS to scope
--                       itself to the caller.
--   profile_stats()  -> GET /profiles/:id/stats (api/src/profiles.controller.ts)
--                       Same three counts; the friend check moved from RLS
--                       (which quietly returned zeros) to assertCanSee, which
--                       returns 403.
--   delete_account() -> DELETE /me         (api/src/profiles.controller.ts)
--                       The API empties the user's photo folder first, then
--                       deletes the auth user through the admin API, which
--                       cascades the rows exactly as this did.
--
-- is_friends_with() stays: three RLS policies still call it.
drop function if exists public.feed_entries(timestamptz, uuid, int);
drop function if exists public.profile_stats(uuid);
drop function if exists public.delete_account();
