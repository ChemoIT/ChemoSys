---
status: diagnosed
trigger: "Dashboard ActivityFeed shows truncated UUIDs instead of user display names, and entity descriptions show raw UUID instead of readable entity name"
created: 2026-03-04T00:00:00Z
updated: 2026-03-04T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — two root causes found
test: Schema analysis of public.users table vs query columns
expecting: N/A — diagnosis complete
next_action: Return diagnosis

## Symptoms

expected: Each activity row shows user's real name (first_name + last_name) and meaningful entity description
actual: Shows truncated UUIDs (user_id.slice(0,8) + "...") for user names, and raw UUID for entity descriptions
errors: No error messages reported — Supabase returns error on non-existent columns, fallback hides it
reproduction: Load dashboard page, observe ActivityFeed section
started: Since initial implementation — columns never existed

## Eliminated

## Evidence

- timestamp: 2026-03-04T00:01:00Z
  checked: public.users table schema in 00001_foundation_schema.sql (lines 248-260)
  found: Table has columns (id, auth_user_id, employee_id, is_blocked, notes, timestamps). NO full_name. NO email.
  implication: Query selecting full_name and email will fail

- timestamp: 2026-03-04T00:02:00Z
  checked: All migrations (00001-00015) for any ALTER TABLE adding full_name or email to users
  found: No migration ever adds these columns. Only 00012 adds is_admin.
  implication: full_name and email have NEVER existed on public.users

- timestamp: 2026-03-04T00:03:00Z
  checked: Dashboard page.tsx line 99 query
  found: .select('auth_user_id, full_name, email') — requests non-existent columns
  implication: Supabase returns error (column not found), userRows is null, userMap is empty, all lookups fall through to fallback

- timestamp: 2026-03-04T00:04:00Z
  checked: Correct pattern in users/page.tsx line 27
  found: Uses Supabase relation join: '*, employees(first_name, last_name, employee_number, email, id_number)'
  implication: The correct pattern is to JOIN through employees via the employee_id FK

- timestamp: 2026-03-04T00:05:00Z
  checked: ActivityFeed.tsx line 122-123 entity_id rendering
  found: Raw entity_id UUID is rendered directly with no resolution to a name
  implication: No entity name resolution was ever implemented — it's a missing feature

- timestamp: 2026-03-04T00:06:00Z
  checked: Same bug in audit-log/page.tsx line 96 and export-audit/route.ts line 83
  found: Both use identical broken query: .select('auth_user_id, full_name, email')
  implication: Bug affects 3 files total, not just dashboard

## Resolution

root_cause: |
  TWO ROOT CAUSES:

  1. USER NAME RESOLUTION (Bug): The query at dashboard/page.tsx:99, audit-log/page.tsx:96,
     and export-audit/route.ts:83 selects columns `full_name` and `email` from `public.users`,
     but these columns DO NOT EXIST on that table. The public.users table only has:
     (id, auth_user_id, employee_id, is_blocked, notes, is_admin, timestamps).
     User names (first_name, last_name) and email live in the `employees` table,
     linked via `users.employee_id -> employees.id`.
     Supabase returns an error for non-existent columns, causing `userRows` to be null,
     `userMap` to be empty, and all lookups to fall through to the truncated UUID fallback.

  2. ENTITY ID DISPLAY (Missing Feature): ActivityFeed.tsx line 122-123 renders `entity_id`
     as a raw UUID. No code exists to resolve entity_id to a human-readable name
     (e.g., employee name, project name). This is not a bug per se — it was never implemented.

fix: |
  FIX 1: Change the user name resolution query in all 3 files to use Supabase relation join:
    .from('users')
    .select('auth_user_id, employees(first_name, last_name, email)')
    .in('auth_user_id', distinctUserIds)
  Then build the display name as: `${u.employees.first_name} ${u.employees.last_name}`

  FIX 2 (entity names): Add entity name resolution in dashboard/page.tsx:
    After fetching audit rows, group entity_ids by entity_type, query each table
    for names (employees -> first_name+last_name, projects -> name, companies -> name, etc.),
    build a Map<entity_id, displayName>, pass as entityName in ActivityEntry.

verification:
files_changed: []
