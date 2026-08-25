import { notFound, redirect } from "next/navigation";
import { apiServer } from "@/lib/api-server";

// Invite link landing: resolve the permanent user code and hand off to the
// profile page, whose non-friend view is the add-friend prompt.
export default async function AddPage(props: PageProps<"/add/[code]">) {
  const { code } = await props.params;
  const profile = await apiServer<{ username: string }>(
    `/invite/${encodeURIComponent(code)}`
  );
  if (!profile) notFound();
  redirect(`/u/${profile.username}`);
}
