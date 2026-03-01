// Auth guard proxy for Next.js 16 — replaces the deprecated middleware.ts.
// Source: Official Next.js 16 upgrade guide + Supabase SSR docs.
//
// IMPORTANT:
// - File MUST be named proxy.ts (not middleware.ts) in Next.js 16.
// - Function MUST be named proxy (not middleware).
// - MUST call getUser() (NOT getClaims()) — getUser() refreshes expiring tokens by writing cookies.
// - Edge runtime is NOT supported here — uses Node.js runtime.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Track response so cookie updates from Supabase can be forwarded to the browser.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // First, update the request cookies so the downstream handler sees them.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Recreate the response with the updated request cookies.
          supabaseResponse = NextResponse.next({ request });
          // Then write the cookies to the response so the browser receives them.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // MUST call getUser() — this is what refreshes expiring JWT tokens.
  // getClaims() verifies locally but does NOT refresh tokens, causing random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginRoute = pathname.startsWith("/login");

  // Unauthenticated users cannot access admin routes.
  if (isAdminRoute && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated users visiting login are redirected to admin.
  if (isLoginRoute && user) {
    return NextResponse.redirect(new URL("/admin/companies", request.url));
  }

  return supabaseResponse;
}

// Matcher excludes static files and Next.js internals.
// Runs on all other routes including API routes and pages.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
