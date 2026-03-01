"use server";

// Authentication Server Actions.
// login(): Validates credentials via Supabase Auth, redirects to admin on success.
// logout(): Signs out and redirects to login.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Shape returned to the client on login error.
type LoginState = { error: string } | null;

/**
 * login — called by the login form via useActionState.
 * On success: redirects to /admin/companies (redirect throws, does not return).
 * On failure: returns { error: "..." } displayed in the form.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
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
