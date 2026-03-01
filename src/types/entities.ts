/**
 * entities.ts
 *
 * Clean DTO types for use in React components, Server Actions, and Zod schemas.
 * These are direct re-exports from the Database interface — they do NOT strip
 * DB metadata. Components receive the full Row type so they always have access
 * to id, created_at, deleted_at, etc. when needed.
 *
 * Import pattern:
 *   import type { Company, CompanyInsert, CompanyUpdate } from '@/types/entities'
 */

import type { Database } from './database'

// ---------------------------------------------------------------------------
// Row types (full DB row — what SELECT returns)
// ---------------------------------------------------------------------------
export type Company        = Database['public']['Tables']['companies']['Row']
export type Department     = Database['public']['Tables']['departments']['Row']
export type RoleTag        = Database['public']['Tables']['role_tags']['Row']
export type Module         = Database['public']['Tables']['modules']['Row']
export type AuditLogEntry  = Database['public']['Tables']['audit_log']['Row']
export type Employee       = Database['public']['Tables']['employees']['Row']
export type RoleTemplate   = Database['public']['Tables']['role_templates']['Row']
export type User           = Database['public']['Tables']['users']['Row']
export type Project        = Database['public']['Tables']['projects']['Row']

// Junction row types
export type EmployeeRoleTag    = Database['public']['Tables']['employee_role_tags']['Row']
export type UserPermission     = Database['public']['Tables']['user_permissions']['Row']
export type TemplatePermission = Database['public']['Tables']['template_permissions']['Row']

// ---------------------------------------------------------------------------
// Insert types (what the caller provides on INSERT)
// ---------------------------------------------------------------------------
export type CompanyInsert      = Database['public']['Tables']['companies']['Insert']
export type DepartmentInsert   = Database['public']['Tables']['departments']['Insert']
export type RoleTagInsert      = Database['public']['Tables']['role_tags']['Insert']
export type AuditLogInsert     = Database['public']['Tables']['audit_log']['Insert']
export type EmployeeInsert     = Database['public']['Tables']['employees']['Insert']
export type RoleTemplateInsert = Database['public']['Tables']['role_templates']['Insert']
export type UserInsert         = Database['public']['Tables']['users']['Insert']
export type ProjectInsert      = Database['public']['Tables']['projects']['Insert']

// ---------------------------------------------------------------------------
// Update types (Partial<Insert> — for PATCH-style mutations)
// ---------------------------------------------------------------------------
export type CompanyUpdate      = Database['public']['Tables']['companies']['Update']
export type DepartmentUpdate   = Database['public']['Tables']['departments']['Update']
export type RoleTagUpdate      = Database['public']['Tables']['role_tags']['Update']
export type EmployeeUpdate     = Database['public']['Tables']['employees']['Update']
export type RoleTemplateUpdate = Database['public']['Tables']['role_templates']['Update']
export type UserUpdate         = Database['public']['Tables']['users']['Update']
export type ProjectUpdate      = Database['public']['Tables']['projects']['Update']

// ---------------------------------------------------------------------------
// Convenience union types for action return values
// ---------------------------------------------------------------------------

/** Standard Server Action return — either data or error, never both. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string | Record<string, string[]> }

/** Soft-delete result — no data payload needed. */
export type DeleteResult =
  | { success: true }
  | { success: false; error: string }
