"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();
  const detected = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const timezones = useMemo<string[]>(
    () =>
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [detected],
    [detected]
  );
  const [username, setUsername] = useState("");
  const [timezone, setTimezone] = useState(detected);
  const [attested, setAttested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      username,
      timezone,
      age_attested_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      setError(
        error.code === "23505" ? "That username is taken." : error.message
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b-2 px-5 pt-10 pb-6" style={{ borderColor: "var(--color-divider)" }}>
        <h1 className="text-[32px] tracking-[-0.03em]">Almost in.</h1>
        <p className="mt-3 text-[14.5px] opacity-80">
          A username, your timezone, and one confirmation.
        </p>
      </div>

      <form
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="field mb-4">
          <label htmlFor="username">Username · lowercase letters, numbers, _</label>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            pattern="[a-z0-9_]{3,20}"
            title="3–20 characters: lowercase letters, numbers, underscores"
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <div className="field mb-5">
          <label htmlFor="timezone">Timezone · used for the 4am night boundary</label>
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

        <div className="hr mb-4" />
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            className="mt-0.5 size-5 accent-[var(--color-accent)]"
            required
          />
          <span className="text-[13px] leading-[1.45]">
            I am 21 or older. Recorded with a timestamp.
          </span>
        </label>
        <p className="mt-3 text-[11.5px] opacity-50">
          Drink responsibly. Nomikai ranks variety, not volume — nothing here
          rewards drinking more.
        </p>

        <button
          className="btn btn-primary btn-block mt-5"
          disabled={busy || !attested}
        >
          Start logging
        </button>
        {error && (
          <p className="mt-4 text-sm font-semibold" style={{ color: "var(--color-accent)" }}>
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
