// Data Access Layer — session verification.
// verifySession() is the single source of truth for "is the user logged in?"
// Used at the top of every protected Server Component and layout.
// Wrapped in React cache() to deduplicate multiple calls in one render tree.

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  userId: string;
  email: string;
};

/**
 * verifySession — fast local JWT verification using getClaims().
 * Does NOT hit the network (no token refresh, no remote lookup).
 * Call this at the top of any admin page or layout.
 *
 * If unauthenticated: redirects to /login (throws — does not return).
 * If authenticated: returns { userId, email }.
 *
 * Wrapped in React cache() so it runs at most once per request
 * even if called from multiple nested layouts/components.
 */
export const verifySession = cache(async (): Promise<SessionUser> => {
  const supabase = await createClient();

  // getClaims() verifies the JWT locally — fast path, no network call.
  // Do NOT use getSession() — it returns unverified local data.
  // Do NOT use getUser() here — it makes a network request on every call.
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const claims = data.claims;

  return {
    userId: claims.sub as string,
    email: (claims.email as string) ?? "",
  };
});
