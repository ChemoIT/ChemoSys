// Source: Supabase official docs (supabase.com/docs/guides/auth/server-side/creating-a-client)
// Server-side Supabase client factory for Server Components, Server Actions, Route Handlers.
// MUST use await cookies() — Next.js 16 removed synchronous cookie access.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies(); // MUST await in Next.js 16

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe to ignore in Server Component context — proxy.ts handles cookie writes.
            // This catch block is expected when called from a Server Component
            // (Server Components cannot set cookies directly).
          }
        },
      },
    }
  );
}
