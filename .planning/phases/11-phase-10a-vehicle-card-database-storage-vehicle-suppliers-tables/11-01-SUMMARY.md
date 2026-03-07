---
phase: 11-phase-10a-vehicle-card-database-storage-vehicle-suppliers-tables
plan: "01"
subsystem: fleet-vehicles-database
tags:
  - migration
  - sql
  - vehicles
  - rls
  - rpc
  - soft-delete
dependency_graph:
  requires:
    - "00018_fleet_drivers (drivers table FK target)"
    - "00001_foundation_schema (companies table, update_updated_at_column function)"
  provides:
    - "vehicle_suppliers table"
    - "vehicles table"
    - "vehicle_tests table"
    - "vehicle_insurance table"
    - "vehicle_documents table"
    - "vehicle_document_names table"
    - "vehicle_computed_status view"
    - "driver_computed_status view (updated)"
    - "9 RPCs: soft-delete x5, update x3, autocomplete x1"
    - "18 RLS policies across 6 tables"
  affects:
    - "driver_computed_status view (replaces version from 00018+00023)"
    - "Phase 12: MOT API sync will populate MOT fields in vehicles table"
    - "Phase 13: Server actions will use soft-delete and update RPCs"
    - "Phase 14-15: UI tabs will query these tables"
tech_stack:
  added: []
  patterns:
    - "Partial unique index (WHERE deleted_at IS NULL) for soft-delete support"
    - "SECURITY DEFINER RPCs for RLS bypass on soft-delete updates"
    - "security_invoker = true on computed status views"
    - "DROP TRIGGER IF EXISTS + CREATE TRIGGER (idempotent pattern from fix_00018_safe.sql)"
    - "DROP POLICY IF EXISTS + CREATE POLICY (idempotent)"
key_files:
  created:
    - supabase/migrations/00025_fleet_vehicles.sql
  modified: []
decisions:
  - "vehicle_suppliers before vehicles in migration (FK dependency order)"
  - "Partial unique index on license_plate (not table UNIQUE constraint) — allows soft-delete reuse of plate"
  - "driver_computed_status updated in same migration — vehicle assignment condition precedes is_occasional_camp_driver"
  - "vehicle_insurance uses supplier_id FK to vehicle_suppliers (not direct insurer fields)"
  - "alert_enabled=TRUE default for vehicle_tests and vehicle_insurance, FALSE for vehicle_documents (mirrors driver pattern)"
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
---

# Phase 11 Plan 01: Vehicle Module Migration (00025) Summary

## One-liner

Complete PostgreSQL migration for vehicle fleet module: 6 tables (vehicle_suppliers, vehicles, vehicle_tests, vehicle_insurance, vehicle_documents, vehicle_document_names), 2 computed status views, 18 RLS policies, 5 soft-delete RPCs, 3 update RPCs, 1 autocomplete RPC — all idempotent.

## What Was Built

### Migration File: `supabase/migrations/00025_fleet_vehicles.sql`

**Tables (in FK dependency order):**

1. **vehicle_suppliers** — ספקים: leasing/insurance/fuel_card/garage/other. Supplier_type CHECK constraint. Soft-delete + audit columns.

2. **vehicles** — רישום רכבים. MOT API fields (nullable, populated by Phase 12). Operational fields (vehicle_type, ownership_type, company_id, assigned_driver_id). 4 supplier FKs (leasing, insurance, fuel_card, garage). Partial unique index on license_plate WHERE deleted_at IS NULL.

3. **vehicle_tests** — טסטים. test_date + expiry_date (both required), passed boolean, test_station, cost, file_url, alert_enabled=TRUE default.

4. **vehicle_insurance** — ביטוח. insurance_type CHECK (mandatory/comprehensive/third_party), policy_number, supplier_id FK, start/expiry dates, cost, file_url, alert_enabled=TRUE default.

5. **vehicle_documents** — מסמכים כלליים. document_name (freetext + autocomplete), file_url, expiry_date, alert_enabled=FALSE default (mirrors driver_documents pattern).

6. **vehicle_document_names** — autocomplete lookup. UNIQUE name + usage_count. No soft-delete.

**Views:**

- `vehicle_computed_status` (NEW): `security_invoker=true`. Active if not deleted AND is_active=TRUE.
- `driver_computed_status` (UPDATED): Replaces 00018+00023 version. Adds vehicle assignment WHEN clause (before is_occasional_camp_driver condition). Removes TODO comment from Phase 9.

**RPCs (9 total):**

| RPC | Type |
|-----|------|
| soft_delete_vehicle | soft-delete |
| soft_delete_vehicle_document | soft-delete |
| soft_delete_vehicle_test | soft-delete |
| soft_delete_vehicle_insurance | soft-delete |
| soft_delete_vehicle_supplier | soft-delete |
| update_vehicle_document | update |
| update_vehicle_test | update |
| update_vehicle_insurance | update |
| increment_vehicle_document_name_usage | autocomplete |

All RPCs: `SECURITY DEFINER` + `SET search_path = public`.

**RLS Policies (18 total):**

| Table | SELECT | INSERT | UPDATE |
|-------|--------|--------|--------|
| vehicle_suppliers | deleted_at IS NULL | WITH CHECK true | USING true |
| vehicles | deleted_at IS NULL | WITH CHECK true | USING true |
| vehicle_tests | deleted_at IS NULL | WITH CHECK true | USING true |
| vehicle_insurance | deleted_at IS NULL | WITH CHECK true | USING true |
| vehicle_documents | deleted_at IS NULL | WITH CHECK true | USING true |
| vehicle_document_names | USING true | WITH CHECK true | USING true |

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | Create vehicle module migration | c5897b1 | supabase/migrations/00025_fleet_vehicles.sql |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `supabase/migrations/00025_fleet_vehicles.sql` — FOUND
- [x] Commit `c5897b1` — FOUND
- [x] 6 CREATE TABLE statements — verified
- [x] 9 RPCs — verified
- [x] 18 RLS policies — verified
- [x] 5 triggers (DROP IF EXISTS + CREATE) — verified
- [x] Partial unique index with WHERE deleted_at IS NULL — verified
- [x] Both views use security_invoker = true — verified
- [x] driver_computed_status includes vehicle assignment WHEN clause — verified
- [x] All policies use DROP IF EXISTS + CREATE (idempotent) — verified

## Next Steps

**Plan 02** (next in Phase 11): Run migration 00025 in Supabase SQL Editor + add Supabase Storage buckets for vehicle files (fleet-vehicle-documents bucket).
