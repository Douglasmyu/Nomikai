"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { signPhotoPaths } from "@/lib/photo";
import Header from "../../header";
import EntryCard, { type EntryRowData } from "../../entry-card";

type NightOut = {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  started_at: string;
};

export default function NightOutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const user = useQuery({
    queryKey: ["user"],
    queryFn: async () => (await createClient().auth.getUser()).data.user,
    staleTime: Infinity,
  });
  const viewerId = user.data?.id ?? null;

  const night = useQuery({
    queryKey: ["night", id],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("night_outs")
        .select("id, user_id, name, location, started_at")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as NightOut;
    },
    retry: false,
  });

  const entries = useQuery({
    queryKey: ["night-entries", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("entries")
        .select(
          "id, user_id, drinks(name), custom_drink_name, night_out_id, location, photo_path, note, recommended, logged_at"
        )
        .eq("night_out_id", id)
        .order("logged_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        id: string;
        user_id: string;
        drinks: { name: string } | null;
        custom_drink_name: string | null;
        night_out_id: string | null;
        location: string | null;
        photo_path: string | null;
        note: string | null;
        recommended: boolean | null;
        logged_at: string;
      }[];
      const signed = await signPhotoPaths(
        supabase,
        rows.map((r) => r.photo_path)
      );
      return rows.map(
        (r): EntryRowData => ({
          ...r,
          username: "",
          avatar_url: null,
          drink_name: r.drinks?.name ?? r.custom_drink_name ?? "",
          night_out_name: null,
          photo_url: r.photo_path ? signed.get(r.photo_path) : null,
        })
      );
    },
  });

  return (
    <main className="flex flex-1 flex-col">
      <Header kicker="Night out" />
      {night.isPending ? (
        <div className="kicker px-4 py-7">Loading…</div>
      ) : night.isError ? (
        <p
          className="px-4 py-7 text-sm font-semibold"
          style={{ color: "var(--color-accent)" }}
        >
          Could not load that night out.
        </p>
      ) : (
        <>
          <div className="px-4 py-5">
            <h2 className="text-[26px] tracking-[-0.03em]">
              {night.data.name}
            </h2>
            <div className="mt-1 text-[13px] opacity-70">
              {new Date(night.data.started_at).toLocaleDateString()}
              {night.data.location && ` · ${night.data.location}`}
            </div>
          </div>
          {entries.data?.map((r) => (
            <EntryCard
              key={r.id}
              row={r}
              editHref={
                r.user_id === viewerId ? `/log?id=${r.id}` : undefined
              }
            />
          ))}
          {entries.isSuccess && !entries.data.length && (
            <p className="px-4 text-[13.5px] opacity-70">
              No entries in this night out.
            </p>
          )}
        </>
      )}
    </main>
  );
}
