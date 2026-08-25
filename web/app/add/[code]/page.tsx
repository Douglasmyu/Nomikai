import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Invite link landing: resolve the permanent user code and hand off to the
// profile page, whose non-friend view is the add-friend prompt.
export default async function AddPage(props: PageProps<"/add/[code]">) {
  const { code } = await props.params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_code", code)
    .single();
  if (!profile) notFound();
  redirect(`/u/${profile.username}`);
}
