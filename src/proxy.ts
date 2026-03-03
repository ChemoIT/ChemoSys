/**
 * Next.js Middleware — Supabase Auth token refresh.
 *
 * CRITICAL: Without this middleware, the Supabase access token (JWT) expires
 * after ~1 hour and is never refreshed server-side. Expired tokens cause
 * all mutations (UPDATE/INSERT) to fail with RLS errors because PostgREST
 * treats expired tokens as the `anon` role (no matching policy).
 *
 * What this middleware does on EVERY request:
 *   1. Reads the Supabase auth cookies from the incoming request
 *   2. Calls getUser() which validates the JWT and refreshes if expired
 *   3. Writes the refreshed cookies to both the request (for server components)
 *      and the response (for the browser)
 *
 * Source: https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update request cookies (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Recreate response to carry updated request cookies
          supabaseResponse = NextResponse.next({ request })
          // Update response cookies (sent back to browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Validate the token and refresh if expired.
  // getUser() makes a network call to Supabase Auth — this is intentional.
  // It ensures the access token is always fresh for server components and actions.
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to /login (except for /login itself)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// Match all routes except static files and images
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
