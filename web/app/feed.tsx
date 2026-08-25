"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signPhotoPaths } from "@/lib/photo";
import EntryCard, { type EntryRowData } from "./entry-card";

const PAGE_SIZE = 30;

type Cursor = { before_logged_at: string; before_id: string } | null;

export default function Feed({ viewerId }: { viewerId: string }) {
  const feed = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: async ({ pageParam }: { pageParam: Cursor }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("feed_entries", {
        ...(pageParam ?? {}),
        lim: PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data ?? []) as EntryRowData[];
      const signed = await signPhotoPaths(supabase, [
        ...rows.map((r) => r.photo_path),
        ...rows.map((r) => r.avatar_url),
      ]);
      return rows.map((r) => ({
        ...r,
        photo_url: r.photo_path ? signed.get(r.photo_path) : null,
        avatar_src: r.avatar_url ? signed.get(r.avatar_url) : null,
      }));
    },
    initialPageParam: null as Cursor,
    getNextPageParam: (last): Cursor =>
      last.length < PAGE_SIZE
        ? null
        : {
            before_logged_at: last[last.length - 1].logged_at,
            before_id: last[last.length - 1].id,
          },
  });

  if (feed.isPending) return <div className="kicker px-4 py-7">Loading…</div>;
  if (feed.isError)
    return (
      <p
        className="px-4 py-7 text-sm font-semibold"
        style={{ color: "var(--color-accent)" }}
      >
        Could not load the feed.
      </p>
    );

  const rows = feed.data.pages.flat();

  if (!rows.length)
    return (
      <div className="px-4 py-7">
        <div className="hr" />
        <h2 className="my-4 text-[32px] leading-[1.05] tracking-[-0.03em]">
          Nothing here yet.
        </h2>
        <p className="mb-4 text-[13.5px] opacity-70">
          Log your first drink, then invite friends to see each other&apos;s
          nights here.
        </p>
        <Link href="/log" className="btn btn-primary btn-block">
          Log a drink
        </Link>
        <Link href="/friends" className="btn btn-secondary btn-block">
          Invite friends
        </Link>
      </div>
    );

  return (
    <div>
      {rows.map((r) => (
        <EntryCard
          key={r.id}
          row={r}
          showAuthor
          editHref={r.user_id === viewerId ? `/log?id=${r.id}` : undefined}
          nightHref={
            r.user_id === viewerId && r.night_out_id
              ? `/nights/${r.night_out_id}`
              : undefined
          }
        />
      ))}
      {feed.hasNextPage && (
        <div className="px-4 py-3">
          <button
            className="btn btn-secondary btn-block !mt-0"
            disabled={feed.isFetchingNextPage}
            onClick={() => feed.fetchNextPage()}
          >
            {feed.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
