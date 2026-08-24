import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountPanel from "./account-panel";

export default async function Home(props: PageProps<"/">) {
  // Email-link redirects can land on "/" when the redirect allow-list falls
  // back to the site URL; hand the code to the confirm route.
  const { code } = await props.searchParams;
  if (typeof code === "string") redirect(`/auth/confirm?code=${code}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, user_code, timezone, created_at")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  return (
    <main className="flex flex-1 flex-col">
      <div
        className="flex items-baseline gap-2.5 border-b-2 px-4 pt-3.5 pb-3"
        style={{ borderColor: "var(--color-divider)" }}
      >
        <h1 className="mr-auto text-[20px] tracking-[-0.02em]">NOMIKAI</h1>
        <span className="kicker">@{profile.username}</span>
      </div>

      <div className="px-4 py-7">
        <div className="hr" />
        <h2 className="my-4 text-[32px] leading-[1.05] tracking-[-0.03em]">
          You&apos;re in.
        </h2>
        <p className="mb-4 text-[13.5px] opacity-70">
          Your account works on its own — no friends required. Logging drinks
          is the next phase of the build.
        </p>

        <div className="kicker mb-2">Your week so far</div>
        <div
          className="grid grid-cols-2 border"
          style={{ borderColor: "var(--color-divider)" }}
        >
          <div
            className="border-r px-3.5 py-3"
            style={{ borderColor: "var(--color-divider)" }}
          >
            <div className="font-extrabold text-[30px] tabular-nums">0</div>
            <div className="kicker">Unique drinks</div>
          </div>
          <div className="px-3.5 py-3">
            <div className="font-extrabold text-[30px] tabular-nums">0</div>
            <div className="kicker">Nights out</div>
          </div>
        </div>
      </div>

      <AccountPanel
        username={profile.username}
        userCode={profile.user_code}
        timezone={profile.timezone}
        email={user.email ?? ""}
      />
    </main>
  );
}
