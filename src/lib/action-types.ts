/**
 * action-types.ts — Shared types for server action responses.
 *
 * ActionWarning: represents a non-fatal side-effect failure.
 * The main operation succeeded, but a secondary operation (email sync,
 * permission write, etc.) failed. Surfaced to the user via ErrorDetailDialog.
 */

export type ActionWarning = {
  /** What we tried to do — e.g. "סנכרון מייל ל-auth.users" */
  context: string
  /** The error message from the failed operation */
  message: string
  /** Optional error code (e.g. Supabase error code) */
  code?: string
}
