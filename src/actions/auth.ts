"use server";

// Authentication Server Actions.
// login(): Validates admin credentials via Supabase Auth, redirects to /admin/dashboard on success.
// loginApp(): Validates ChemoSys credentials, checks module permission, redirects to /app/{module}.
// logout(): Signs out and redirects to login.
//
// Rate limiting: in-memory Map persisted in Node.js runtime.
// Max 5 attempts per IP per 60 seconds. NOT suitable for multi-instance
// production (use Redis/Upstash then). Acceptable for single-admin deployment.
// loginAttempts and loginAppAttempts are SEPARATE Maps — different attack surfaces
// must not share rate limit counters.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Shape returned to the client on login error.
type LoginState = { error: string } | null;
type LoginAppState = { error: string } | null;

// --- Rate limiting (in-memory, Node.js runtime) ---
// Module-level Maps persist across requests within the same serverless instance.
// Resets on cold start — acceptable for single-admin deployment.
// NOT suitable for multi-instance production (use Redis/Upstash then).

type RateLimitEntry = { count: number; resetAt: number };
const loginAttempts = new Map<string, RateLimitEntry>();
const loginAppAttempts = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 5; // max attempts per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function getClientIp(headersList: Headers): string {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * checkRateLimit — generic rate limiter for any in-memory store.
 * Returns true if the IP is within the allowed rate, false if blocked.
 * Takes the rate limit Map as a parameter so admin and app logins are independent.
 */
function checkRateLimit(ip: string, store: Map<string, RateLimitEntry>): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  // First attempt or window expired — reset
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  // Over limit
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  // Under limit — increment
  entry.count++;
  return true;
}

/**
 * login — called by the admin login form via useActionState.
 * On success: redirects to /admin/dashboard (redirect throws, does not return).
 * On failure: returns { error: "..." } displayed in the form.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // Rate limit check — before any auth logic
  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (!checkRateLimit(ip, loginAttempts)) {
    return { error: "יותר מדי ניסיונות התחברות. נסה שוב בעוד דקה." };
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Basic guard — form fields are required but JS can be disabled.
  if (!email || !password) {
    return { error: "נא למלא מייל וסיסמה" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Log for server-side diagnostics without exposing auth details to client.
    console.warn("[auth] login failed:", error.message);
    return { error: "מייל או סיסמה שגויים" };
  }

  // Redirect throws internally — never returns a value.
  redirect("/admin/dashboard");
}

/**
 * loginApp — called by the ChemoSys login form via useActionState.
 * Authenticates, checks module permission, and redirects to /app/{module}.
 *
 * Flow:
 *   1. Rate limit check
 *   2. Validate form fields (email, password, module)
 *   3. signInWithPassword() — authenticate
 *   4. Check public.users row (not blocked)
 *   5. Check get_user_permissions RPC for app_{module}
 *   6. Redirect to /app/{module} on success
 *
 * On failure: returns { error: "..." } displayed in the form.
 */
export async function loginApp(
  _prevState: LoginAppState,
  formData: FormData
): Promise<LoginAppState> {
  // Rate limit check — separate counter from admin login
  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (!checkRateLimit(ip, loginAppAttempts)) {
    return { error: "יותר מדי ניסיונות התחברות. נסה שוב בעוד דקה." };
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const module = formData.get("module") as string;

  // Basic guard — form fields are required but JS can be disabled.
  if (!email || !password) {
    return { error: "נא למלא מייל וסיסמה" };
  }

  // Validate module choice (default to fleet if missing/invalid)
  const validModules = ["fleet", "equipment"] as const;
  const selectedModule = validModules.includes(module as typeof validModules[number])
    ? module
    : "fleet";

  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.warn("[auth] loginApp failed:", error.message);
    return { error: "מייל או סיסמה שגויים" };
  }

  const authUserId = authData.user.id;

  // Check user is registered and not blocked
  const { data: userRow } = await supabase
    .from("users")
    .select("is_blocked")
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!userRow) {
    await supabase.auth.signOut();
    return { error: "המשתמש אינו רשום במערכת" };
  }

  if (userRow.is_blocked) {
    await supabase.auth.signOut();
    return { error: "המשתמש חסום — פנה לאחראי המערכת" };
  }

  // Check module permission via RPC
  const { data: perms } = await supabase.rpc("get_user_permissions", {
    p_user_id: authUserId,
  });

  const moduleKey = `app_${selectedModule}`;
  const hasAccess = perms?.some(
    (p: { module_key: string; level: number }) =>
      p.module_key === moduleKey && p.level >= 1
  );

  if (!hasAccess) {
    await supabase.auth.signOut();
    return { error: "אין לך גישה למודול זה — פנה לאחראי המערכת" };
  }

  // Redirect to the selected module
  redirect(`/app/${selectedModule}`);
}

/**
 * logout — signs out the current user and redirects to /login.
 * Safe to call from any Server Action or server component button.
 */
export async function logout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * logoutApp — signs out the current user and redirects to /chemosys (ChemoSys login).
 * Used by AppLogoutButton in the (app) shell. Distinct from logout() which redirects
 * to /login (admin). ChemoSys users should return to the ChemoSys login page, not admin.
 */
export async function logoutApp(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/chemosys");
}
