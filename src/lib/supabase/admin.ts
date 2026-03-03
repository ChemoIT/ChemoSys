import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * createAdminClient — Supabase client with service_role key.
 * Required for auth.admin.createUser, deleteUser, updateUserById.
 * NEVER import this file in a client component — server-only guard.
 *
 * Bypasses Row Level Security — use only in Server Actions.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
