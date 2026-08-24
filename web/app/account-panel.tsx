"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountPanel(props: {
  username: string;
  userCode: string;
  timezone: string;
  email: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(props.username);
  const [timezone, setTimezone] = useState(props.timezone);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const timezones = useMemo<string[]>(
    () =>
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [props.timezone],
    [props.timezone]
  );

  async function save() {
    setBusy(true);
    setStatus(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ username, timezone })
      .eq("id", user!.id);
    setBusy(false);
    if (error) {
      setStatus(
        error.code === "23505" ? "That username is taken." : error.message
      );
      return;
    }
    setStatus("Saved.");
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function deleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_account");
    if (error) {
      setBusy(false);
      setStatus(error.message);
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mt-auto px-4 pb-8">
      <div className="hr mb-4" />
      <div className="kicker mb-3">Account</div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
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

      <p className="mt-4 text-[11.5px] opacity-50">
        Signed in as {props.email} · permanent code {props.userCode}
      </p>
      {status && <p className="mt-2 text-sm font-semibold">{status}</p>}

      <div className="hr my-4" />
      <button className="btn btn-secondary btn-block !min-h-[42px]" onClick={signOut}>
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
        onClick={deleteAccount}
      >
        {confirmDelete
          ? "Tap again to permanently delete everything"
          : "Delete account"}
      </button>
    </div>
  );
}
