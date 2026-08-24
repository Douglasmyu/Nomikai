"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "email" | "password" | "code";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("email");
  // "email" = OTP verify, "signup" = confirm a new password account
  const [codeType, setCodeType] = useState<"email" | "signup">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${location.origin}/auth/confirm`,
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setCodeType("email");
    setMode("code");
  }

  async function signInWithPassword() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/");
    router.refresh();
  }

  async function createAccount() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }
    setCodeType("signup");
    setMode("code");
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: codeType,
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b-2 px-5 pt-10 pb-6" style={{ borderColor: "var(--color-divider)" }}>
        <h1 className="text-[44px] leading-[0.95] tracking-[-0.045em]">NOMIKAI</h1>
        <div className="kicker mt-2 !text-[12px] !tracking-[0.2em]">
          飲み会 · a drinking party
        </div>
        <p className="mt-4 text-[14.5px] opacity-80">
          Log what you drank, where, and when. See what your friends are
          trying. No install — it&apos;s a link.
        </p>
      </div>

      <div className="p-5">
        {mode === "code" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyCode();
            }}
          >
            <p className="text-sm opacity-80">
              We emailed <strong>{email}</strong>. Enter the 6-digit code, or
              click the link in the email — either works.
            </p>
            <div className="field mt-3">
              <label htmlFor="code">Code</label>
              <input
                id="code"
                className="input text-center font-extrabold tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                required
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy || code.length < 6}>
              Verify code
            </button>
            <button
              type="button"
              className="btn btn-ghost mt-3 text-sm"
              onClick={() => {
                setCode("");
                setMode("email");
              }}
            >
              Use a different email
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "email") sendCode();
              else signInWithPassword();
            }}
          >
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {mode === "password" && (
              <div className="field mt-3">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}

            {mode === "email" ? (
              <>
                <button className="btn btn-primary btn-block" disabled={busy}>
                  Email me a code
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => setMode("password")}
                >
                  Use a password instead
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-block" disabled={busy}>
                  Sign in
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  disabled={busy}
                  onClick={createAccount}
                >
                  Create account with this password
                </button>
                <button
                  type="button"
                  className="btn btn-ghost mt-3 text-sm"
                  onClick={() => setMode("email")}
                >
                  Email me a code instead
                </button>
              </>
            )}
          </form>
        )}

        {error && (
          <p className="mt-4 text-sm font-semibold" style={{ color: "var(--color-accent)" }}>
            {error}
          </p>
        )}
      </div>

      <div className="mt-auto px-5 pb-6">
        <div className="hr mb-4" />
        <p className="text-[11.5px] opacity-50">
          Nomikai ranks variety, not volume. Nothing here rewards drinking
          more. Non-alcoholic drinks count the same.
        </p>
      </div>
    </main>
  );
}
