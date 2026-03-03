"use server";

// Authentication Server Actions.
// login(): Validates credentials via Supabase Auth, redirects to admin on success.
// logout(): Signs out and redirects to login.
//
// Rate limiting: in-memory Map persisted in Node.js runtime.
// Max 5 attempts per IP per 60 seconds. NOT suitable for multi-instance
// production (use Redis/Upstash then). Acceptable for single-admin deployment.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Shape returned to the client on login error.
type LoginState = { error: string } | null;

// --- Rate limiting (in-memory, Node.js runtime) ---
// Module-level Map persists across requests within the same serverless instance.
// Resets on cold start — acceptable for single-admin deployment.
// NOT suitable for multi-instance production (use Redis/Upstash then).

type RateLimitEntry = { count: number; resetAt: number };
const loginAttempts = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 5; // max attempts per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function getClientIp(headersList: Headers): string {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  );
}

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  // First attempt or window expired — reset
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
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
 * login — called by the login form via useActionState.
 * On success: redirects to /admin/companies (redirect throws, does not return).
 * On failure: returns { error: "..." } displayed in the form.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // Rate limit check — before any auth logic
  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (!checkLoginRateLimit(ip)) {
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
  redirect("/admin/companies");
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
