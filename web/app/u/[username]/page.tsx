import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "../../header";
import ProfileView from "./profile-view";

export default async function ProfilePage(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, user_code, timezone")
    .eq("username", username)
    .single();
  if (!profile) notFound();

  const own = profile.id === user.id;
  return (
    <main className="flex flex-1 flex-col">
      <Header kicker={own ? "Your profile" : "Profile"} />
      <ProfileView
        profile={profile}
        viewerId={user.id}
        email={own ? (user.email ?? "") : null}
      />
    </main>
  );
}
