import { apiFetch } from "./api";
import { createClient } from "./supabase/server";

/**
 * Server-component calls. The API verifies the token's signature itself, so
 * reading it from the cookie session (rather than getUser) is safe here.
 */
export async function apiServer<T>(
  path: string,
  init?: RequestInit
): Promise<T | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  try {
    return await apiFetch<T>(token, path, init);
  } catch (e) {
    // Missing rows are a routing decision for the caller (notFound / redirect).
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}
