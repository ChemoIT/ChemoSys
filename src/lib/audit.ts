// Audit log utility — write immutable audit entries to the audit_log table.
// Called by every mutation (INSERT, UPDATE, DELETE) in the admin system.
//
// CRITICAL DESIGN: audit log write failure MUST NOT block the main operation.
// If this fails, log a warning to console — do not throw, do not surface to user.

import { createClient } from "@/lib/supabase/server";

export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

export type WriteAuditLogParams = {
  /** ID of the user performing the action (from verifySession) */
  userId: string;
  /** The mutation type */
  action: AuditAction;
  /** Table name, e.g. 'companies', 'departments', 'role_tags' */
  entityType: string;
  /** UUID of the record being mutated */
  entityId: string;
  /** Previous state of the record (null for INSERT) */
  oldData?: Record<string, unknown> | null;
  /** New state of the record (null for DELETE) */
  newData?: Record<string, unknown> | null;
};

/**
 * writeAuditLog — insert a single row into the audit_log table.
 *
 * Usage (in a Server Action after a successful mutation):
 *   await writeAuditLog({
 *     userId: session.userId,
 *     action: 'INSERT',
 *     entityType: 'companies',
 *     entityId: newCompany.id,
 *     oldData: null,
 *     newData: newCompany,
 *   });
 *
 * This function is intentionally fire-and-forget — it catches all errors
 * internally and does not propagate them to the caller.
 */
export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("audit_log").insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
    });

    if (error) {
      // Do not throw — audit failure must not roll back the business operation.
      console.warn("[audit] Failed to write audit log:", error.message, {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
      });
    }
  } catch (err) {
    // Catch unexpected errors (network, config) — same policy: warn, don't throw.
    console.warn("[audit] Unexpected error in writeAuditLog:", err);
  }
}
