"use client";

import Link from "next/link";

// Shape of one feed/profile row, matching feed_entries(); photo_url and
// avatar_src are signed URLs attached client-side after fetch.
export type EntryRowData = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  drink_name: string;
  night_out_id: string | null;
  night_out_name: string | null;
  location: string | null;
  photo_path: string | null;
  note: string | null;
  recommended: boolean | null;
  logged_at: string;
  photo_url?: string | null;
  avatar_src?: string | null;
};

export function relativeTime(iso: string) {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return new Date(iso).toLocaleDateString();
}

export default function EntryCard({
  row,
  showAuthor = false,
  editHref,
  nightHref,
}: {
  row: EntryRowData;
  showAuthor?: boolean;
  editHref?: string; // own entries: link to /log?id=
  nightHref?: string; // own profile: link the label to /nights/[id]
}) {
  return (
    <div
      className="border-b px-4 py-3"
      style={{ borderColor: "var(--color-divider)" }}
    >
      <div className="flex items-baseline gap-2">
        {showAuthor && (
          <Link
            href={`/u/${row.username}`}
            className="flex items-center gap-1.5 text-sm font-extrabold !text-[inherit] no-underline"
          >
            {row.avatar_src && (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL, remote patterns don't apply
              <img
                src={row.avatar_src}
                alt=""
                className="h-5 w-5 object-cover"
              />
            )}
            @{row.username}
          </Link>
        )}
        <span className="kicker ml-auto">{relativeTime(row.logged_at)}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-[19px] font-extrabold tracking-[-0.02em]">
          {row.drink_name}
        </span>
        {row.recommended === true && <span className="kicker">rec’d</span>}
        {row.recommended === false && <span className="kicker">skip it</span>}
        {editHref && (
          <Link href={editHref} className="btn btn-ghost ml-auto text-sm">
            Edit
          </Link>
        )}
      </div>
      {(row.night_out_name || row.location) && (
        <div className="mt-0.5 text-[13px] opacity-70">
          {row.night_out_name &&
            (nightHref ? (
              <Link href={nightHref}>{row.night_out_name}</Link>
            ) : (
              <span>{row.night_out_name}</span>
            ))}
          {row.night_out_name && row.location && " · "}
          {row.location}
        </div>
      )}
      {row.note && <p className="mt-1 text-[14px]">{row.note}</p>}
      {row.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, remote patterns don't apply
        <img
          src={row.photo_url}
          alt={`Photo of ${row.drink_name}`}
          className="mt-2 max-h-80 w-full object-cover"
        />
      )}
    </div>
  );
}
