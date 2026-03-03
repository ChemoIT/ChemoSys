---
status: diagnosed
trigger: "Audit Log Table shows truncated UUIDs in user and entity ID columns instead of human-readable names"
created: 2026-03-04T00:00:00Z
updated: 2026-03-04T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED — two distinct root causes for the two columns
test: Read schema + page.tsx + component code
expecting: Missing column / missing lookup logic
next_action: Return diagnosis

## Symptoms

expected: "user" column shows real name (first_name + last_name), "entity ID" column shows readable identifier
actual: Both columns show truncated UUIDs
errors: None (visual display issue)
reproduction: Navigate to /admin/audit-log
started: Since implementation

## Eliminated

## Evidence

- timestamp: 2026-03-04T00:00:30Z
  checked: public.users table schema (00001_foundation_schema.sql lines 248-260)
  found: public.users has columns: id, auth_user_id, employee_id, is_blocked, notes, is_admin. NO full_name column, NO email column.
  implication: Both page.tsx and dashboard query `.select('auth_user_id, full_name, email')` on public.users — `full_name` and `email` do NOT exist on this table. Supabase returns null for non-existent columns or silently ignores them.

- timestamp: 2026-03-04T00:00:40Z
  checked: employees table schema (00001_foundation_schema.sql lines 149-169)
  found: employees has first_name, last_name, email. public.users has employee_id FK to employees.
  implication: User display names must be resolved via users → employees join (users.employee_id → employees.first_name + last_name)

- timestamp: 2026-03-04T00:00:50Z
  checked: AuditLogTable.tsx entity_id column (lines 200-216)
  found: entity_id column is intentionally rendered as `id?.substring(0, 8) + '...'` with full UUID as tooltip. No entity name lookup exists.
  implication: Entity ID display is by design (truncated UUID), but there is no attempt to resolve entity names from their respective tables.

- timestamp: 2026-03-04T00:00:55Z
  checked: page.tsx user resolution (lines 88-105)
  found: Queries `supabase.from('users').select('auth_user_id, full_name, email')` — selecting columns that don't exist on users table
  implication: userRows likely returns rows with null for full_name and email, so fallback `u.auth_user_id.substring(0, 8)` is used — producing truncated UUIDs

- timestamp: 2026-03-04T00:01:00Z
  checked: Dashboard page.tsx (lines 97-107) — same pattern
  found: Identical broken query: `.select('auth_user_id, full_name, email')` on public.users which lacks those columns
  implication: Dashboard ActivityFeed has the SAME root cause — confirms shared bug

## Resolution

root_cause: TWO ISSUES — (1) User name query selects non-existent columns `full_name` and `email` from public.users table (which only has id, auth_user_id, employee_id, is_blocked, notes, is_admin). Names live on the `employees` table (first_name, last_name) linked via users.employee_id. (2) Entity ID column has no lookup logic — just renders truncated UUID.
fix:
verification:
files_changed: []
