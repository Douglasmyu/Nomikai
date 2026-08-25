"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { signPhotoPaths } from "@/lib/photo";
import EntryCard, { type EntryRowData } from "../../entry-card";
import AccountPanel from "../../account-panel";

const PAGE_SIZE = 30;

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  user_code: string;
  timezone: string;
};

type EntryQueryRow = {
  id: string;
  user_id: string;
  drinks: { name: string } | null;
  custom_drink_name: string | null;
  night_out_id: string | null;
  night_outs: { name: string } | null;
  location: string | null;
  photo_path: string | null;
  note: string | null;
  recommended: boolean | null;
  logged_at: string;
};

export default function ProfileView({
  profile,
  viewerId,
  email,
}: {
  profile: Profile;
  viewerId: string;
  email: string | null; // non-null only on the own profile
}) {
  const own = profile.id === viewerId;
  const queryClient = useQueryClient();

  const friendship = useQuery({
    queryKey: ["friendship", profile.id],
    enabled: !own,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("friendships")
        .select("id, requester_id, status")
        .or(
          `and(requester_id.eq.${viewerId},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${viewerId})`
        )
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const state = own
    ? "self"
    : friendship.data == null
      ? "none"
      : friendship.data.status === "accepted"
        ? "friends"
        : friendship.data.requester_id === viewerId
          ? "pending-out"
          : "pending-in";
  const canSee = own || state === "friends";

  const avatar = useQuery({
    queryKey: ["avatar", profile.id, profile.avatar_url],
    enabled: !!profile.avatar_url,
    queryFn: async () =>
      (await signPhotoPaths(createClient(), [profile.avatar_url])).get(
        profile.avatar_url!
      ) ?? null,
  });

  const stats = useQuery({
    queryKey: ["stats", profile.id],
    enabled: canSee,
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc("profile_stats", { profile_id: profile.id })
        .single();
      if (error) throw error;
      return data as {
        total_entries: number;
        unique_drinks: number;
        nights_out: number;
      };
    },
  });

  const entries = useInfiniteQuery({
    queryKey: ["entries", profile.id],
    enabled: canSee,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("entries")
        .select(
          "id, user_id, drinks(name), custom_drink_name, night_out_id, night_outs(name), location, photo_path, note, recommended, logged_at"
        )
        .eq("user_id", profile.id)
        // logged_at ties at minute precision; created_at then id make the
        // order (and offset pagination) deterministic
        .order("logged_at", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as EntryQueryRow[];
      const signed = await signPhotoPaths(
        supabase,
        rows.map((r) => r.photo_path)
      );
      return rows.map(
        (r): EntryRowData => ({
          ...r,
          username: profile.username,
          avatar_url: profile.avatar_url,
          drink_name: r.drinks?.name ?? r.custom_drink_name ?? "",
          night_out_name: r.night_outs?.name ?? null,
          photo_url: r.photo_path ? signed.get(r.photo_path) : null,
        })
      );
    },
    getNextPageParam: (last, _all, lastOffset) =>
      last.length < PAGE_SIZE ? null : lastOffset + PAGE_SIZE,
  });

  // Send / accept / withdraw all land here; visibility changes with them,
  // so refetch everything rather than tracking which keys are affected.
  const sendRequest = useMutation({
    mutationFn: async () => {
      const { error } = await createClient().from("friendships").insert({
        requester_id: viewerId,
        addressee_id: profile.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const accept = useMutation({
    mutationFn: async () => {
      const { error } = await createClient()
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendship.data!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const withdraw = useMutation({
    mutationFn: async () => {
      const { error } = await createClient()
        .from("friendships")
        .delete()
        .eq("id", friendship.data!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const busy = sendRequest.isPending || accept.isPending || withdraw.isPending;

  return (
    <>
      <div className="px-4 py-5">
        <div className="flex items-center gap-3">
          {avatar.data && (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL, remote patterns don't apply
            <img src={avatar.data} alt="" className="h-14 w-14 object-cover" />
          )}
          <div>
            <h2 className="text-[26px] tracking-[-0.03em]">
              @{profile.username}
            </h2>
            {state === "friends" && <span className="kicker">Friends</span>}
          </div>
        </div>

        {!own && state !== "friends" && (
          <div className="mt-4">
            {state === "none" && (
              <button
                className="btn btn-primary btn-block !mt-0"
                disabled={busy || friendship.isPending}
                onClick={() => sendRequest.mutate()}
              >
                Add friend
              </button>
            )}
            {state === "pending-out" && (
              <button
                className="btn btn-secondary btn-block !mt-0"
                disabled={busy}
                onClick={() => withdraw.mutate()}
              >
                Request sent · tap to cancel
              </button>
            )}
            {state === "pending-in" && (
              <>
                <button
                  className="btn btn-primary btn-block !mt-0"
                  disabled={busy}
                  onClick={() => accept.mutate()}
                >
                  Accept friend request
                </button>
                <button
                  className="btn btn-secondary btn-block"
                  disabled={busy}
                  onClick={() => withdraw.mutate()}
                >
                  Decline
                </button>
              </>
            )}
            <p className="mt-3 text-[13.5px] opacity-70">
              Drinks and stats are visible to friends only.
            </p>
          </div>
        )}

        {canSee && stats.data && (
          <div
            className="mt-4 grid grid-cols-3 border"
            style={{ borderColor: "var(--color-divider)" }}
          >
            {(
              [
                [stats.data.total_entries, "Entries"],
                [stats.data.unique_drinks, "Unique drinks"],
                [stats.data.nights_out, "Nights out"],
              ] as const
            ).map(([n, label], i) => (
              <div
                key={label}
                className={`px-3.5 py-3 ${i < 2 ? "border-r" : ""}`}
                style={{ borderColor: "var(--color-divider)" }}
              >
                <div className="font-extrabold text-[26px] tabular-nums">
                  {n}
                </div>
                <div className="kicker">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canSee && (
        <div>
          {entries.data?.pages.flat().map((r) => (
            <EntryCard
              key={r.id}
              row={r}
              editHref={own ? `/log?id=${r.id}` : undefined}
              nightHref={
                own && r.night_out_id ? `/nights/${r.night_out_id}` : undefined
              }
            />
          ))}
          {entries.hasNextPage && (
            <div className="px-4 py-3">
              <button
                className="btn btn-secondary btn-block !mt-0"
                disabled={entries.isFetchingNextPage}
                onClick={() => entries.fetchNextPage()}
              >
                {entries.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {own && email !== null && (
        <AccountPanel
          username={profile.username}
          userCode={profile.user_code}
          timezone={profile.timezone}
          email={email}
          avatarUrl={profile.avatar_url}
        />
      )}
    </>
  );
}
