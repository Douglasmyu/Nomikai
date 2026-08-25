"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressPhoto } from "@/lib/photo";

// Supabase throws PostgrestError (has .code) or AuthError (doesn't).
function message(e: unknown) {
  const err = e as { code?: string; message?: string };
  if (err.code === "23505") return "That username is taken.";
  return err.message ?? "Something went wrong.";
}

export default function AccountPanel(props: {
  username: string;
  userCode: string;
  timezone: string;
  email: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(props.username);
  const [timezone, setTimezone] = useState(props.timezone);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timezones = useMemo<string[]>(
    () =>
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [props.timezone],
    [props.timezone]
  );

  const save = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({ username, timezone })
        .eq("id", user!.id);
      if (error) throw error;
    },
    // The profile is rendered by the server component above us.
    onSuccess: () => router.refresh(),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const blob = await compressPhoto(file);
      const path = `${user!.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      // avatar_url stores the storage path; renders go through signed URLs
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      router.refresh();
    },
  });

  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      router.push("/login");
      router.refresh();
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      // §3: photos are purged permanently — delete_account() cascades rows but
      // not storage objects, so empty the photos folder first.
      // ponytail: list() caps at 100 objects; paginate if anyone ever logs more photos than that
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: files } = await supabase.storage.from("photos").list(user.id);
        if (files?.length) {
          await supabase.storage
            .from("photos")
            .remove(files.map((f) => `${user.id}/${f.name}`));
        }
      }
      const { error } = await supabase.rpc("delete_account");
      if (error) throw error;
      await supabase.auth.signOut();
    },
    onSuccess: () => {
      router.push("/login");
      router.refresh();
    },
  });

  const busy = save.isPending || deleteAccount.isPending;
  const failure =
    save.error ?? signOut.error ?? deleteAccount.error ?? uploadAvatar.error;
  const status = failure
    ? message(failure)
    : save.isSuccess || uploadAvatar.isSuccess
      ? "Saved."
      : null;

  return (
    <div className="mt-auto px-4 pb-8">
      <div className="hr mb-4" />
      <div className="kicker mb-3">Account</div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="field mb-3">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            pattern="[a-z0-9_]{3,20}"
            title="3–20 characters: lowercase letters, numbers, underscores"
            required
          />
        </div>
        <div className="field mb-3">
          <label htmlFor="timezone">Timezone</label>
          <select
            id="timezone"
            className="input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary btn-block !min-h-[42px]" disabled={busy}>
          Save changes
        </button>
      </form>

      <div className="field mt-3">
        <label htmlFor="avatar">
          {props.avatarUrl ? "Change avatar" : "Avatar"}
        </label>
        <input
          id="avatar"
          className="input !py-2"
          type="file"
          accept="image/*"
          disabled={uploadAvatar.isPending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAvatar.mutate(f);
          }}
        />
      </div>

      <p className="mt-4 text-[11.5px] opacity-50">
        Signed in as {props.email} · permanent code {props.userCode}
      </p>
      {status && <p className="mt-2 text-sm font-semibold">{status}</p>}

      <div className="hr my-4" />
      <button
        className="btn btn-secondary btn-block !min-h-[42px]"
        onClick={() => signOut.mutate()}
      >
        Sign out
      </button>
      <button
        className="btn btn-block !min-h-[42px]"
        style={{
          borderColor: "var(--color-accent)",
          color: "var(--color-accent)",
          borderWidth: 1,
        }}
        disabled={busy}
        onClick={() => {
          if (!confirmDelete) return setConfirmDelete(true);
          deleteAccount.mutate();
        }}
      >
        {confirmDelete
          ? "Tap again to permanently delete everything"
          : "Delete account"}
      </button>
    </div>
  );
}
