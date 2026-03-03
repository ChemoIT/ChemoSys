---
phase: 04-projects
plan: "02"
subsystem: projects-form-components
tags: [react, components, leaflet, supabase-storage, form, dialog, employee-selector]
dependency_graph:
  requires:
    - 04-01 (ProjectSchema + createProject/updateProject Server Actions + leaflet installed)
    - 02-employees (employees table for PM/SM/CVC EmployeeCombobox data)
  provides:
    - EmployeeCombobox component (reusable single-select with auto-pull callback)
    - ProjectLocationPicker component (react-leaflet OpenStreetMap with Circle)
    - ProjectForm dialog (full 7-section create/edit form)
  affects:
    - 04-03-plan (ProjectsTable passes employees + clocks props to ProjectForm)
tech_stack:
  added: []
  patterns:
    - dynamic(ssr:false) for react-leaflet to prevent SSR window crash
    - EmployeeCombobox: Popover+Command single-select with auto-pull callback
    - Logo upload to Supabase Storage 'client-logos' before form submit (same as employee photo)
    - CVC conditional mode: employee selector or manual Israeli mobile input
    - Attendance clocks: dynamic add/remove array in state, serialised as JSON hidden input
    - Hidden inputs alongside native select — same established pattern as DepartmentForm/EmployeeForm
    - Boolean fields: hidden inputs with 'true'/'false' strings, normalised by formDataToBoolean in Server Action
key_files:
  created:
    - src/components/admin/projects/EmployeeCombobox.tsx
    - src/components/admin/projects/ProjectLocationPicker.tsx
  modified:
    - src/components/admin/projects/ProjectForm.tsx (placeholder → full 7-section implementation)
decisions:
  - "ProjectLocationPicker loaded via dynamic(ssr:false) in ProjectForm — Leaflet accesses window at import time"
  - "EmployeeCombobox custom filter function used — cmdk default filter matches on value (ID) not label"
  - "CVC phone is read-only in employee mode, required + Israeli mobile regex validation in manual mode"
  - "Client-side duplicate clock ID check in handleSubmit before Server Action — prevents DB unique constraint error with user-friendly message"
  - "ProjectForm replaces Plan 03 placeholder — maintains same props interface so ProjectsTable requires no changes"
metrics:
  duration: "~8 min (453 seconds)"
  completed: "2026-03-03"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 4 Plan 02: ProjectForm Components Summary

**One-liner:** Full project dialog form (7 sections, 962 lines) with EmployeeCombobox auto-pull, react-leaflet location picker (ssr:false), dynamic clocks list, and Supabase Storage logo upload.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | EmployeeCombobox + ProjectLocationPicker | 316d88b | EmployeeCombobox.tsx, ProjectLocationPicker.tsx |
| 2 | ProjectForm dialog with all sections | d1438ff | ProjectForm.tsx (962 lines, replaces placeholder) |

## What Was Built

### EmployeeCombobox (`src/components/admin/projects/EmployeeCombobox.tsx`)

Reusable single-select employee picker using Popover + Command (cmdk) pattern — identical architecture to `RoleTagMultiSelect` but for single selection.

Key features:
- Props: `employees`, `value` (employee ID), `onChange(id, {email, mobile_phone})`, `placeholder`, `disabled`
- Custom `filter` function on `<Command>` — filters by full name OR employee number (cmdk default filters on `value` prop which is a UUID, not human-readable)
- "ניקוי בחירה" item at top when a value is selected — clears selection with empty callback
- Check icon shows on selected item
- 167 lines

### ProjectLocationPicker (`src/components/admin/projects/ProjectLocationPicker.tsx`)

Interactive OpenStreetMap using react-leaflet v5.

Key features:
- `'use client'` + `import 'leaflet/dist/leaflet.css'` at top (critical — must be in the client component, not Server Component)
- Props: `latitude`, `longitude`, `radius`, `onLocationChange(lat, lng)`
- `ClickHandler` internal component using `useMapEvents` hook — fires `onLocationChange` on every map click
- `MapContainer` with explicit `style={{ height: '300px', width: '100%' }}` (required — Leaflet collapses without explicit height)
- Default center: Israel `[31.5, 34.8]` zoom 8; zooms to 14 when location is set
- `<Circle>` with `pathOptions` blue `#2563eb`, `fillOpacity: 0.2` renders radius around selected point
- MUST NOT be imported directly in ProjectForm — loaded via `dynamic(ssr:false)` to prevent `window is not defined` during SSR
- 96 lines

### ProjectForm (`src/components/admin/projects/ProjectForm.tsx`)

Full project create/edit dialog with 7 sections — replaced the Plan 03 placeholder.

**Dialog structure:** sticky header (title + action buttons) + `overflow-y-auto` scrollable body + sticky footer (duplicate action buttons for long-form UX). Same pattern as `EmployeeForm`.

**Section details:**

| Section | Content | Key Patterns |
|---------|---------|--------------|
| 1. פרטים בסיסיים | name*, project_number (disabled), open_date, expense_number, project_type select, status select, description textarea | Native select + hidden input (established pattern) |
| 2. מנהלים | PM: EmployeeCombobox → auto-fill pm_email + pm_phone (editable) + pm_notifications checkbox. SM: same pattern | 4 hidden inputs per manager |
| 3. CVC | Radio toggle employee/manual mode. Employee: combobox + read-only phone. Manual: editable phone + Israeli mobile validation | cvc_is_employee hidden input controls Server Action superRefine |
| 4. מזמין | client_name input + logo file upload (preview img + upload/remove buttons) | Upload to Supabase Storage 'client-logos' in handleSubmit, sets client_logo_url hidden input |
| 5. פיקוח | supervision_company, supervision_contact, supervision_email, supervision_phone + 2 checkboxes | supervision_notifications + supervision_attach_reports hidden inputs |
| 6. שעוני נוכחות | Dynamic array: add/remove clock ID inputs + "הוסף שעון" button. Duplicate check before submit | JSON.stringify to hidden input attendance_clocks |
| 7. מיקום | Lat/Lng read-only displays + radius number input + DynamicLocationPicker map | 3 hidden inputs: latitude, longitude, radius |

**Form submission flow (same as EmployeeForm photo upload):**
1. `e.preventDefault()` — intercept native submit
2. Duplicate clock ID client-side validation (user-friendly Hebrew error via `toast.error`)
3. If `logoFile` set: upload to Supabase Storage `'client-logos'` bucket, get public URL, set `client_logo_url` in FormData
4. `startTransition(() => formAction(formData))` — submit to Server Action

**Edit mode hydration:** All state initialised from `project` prop on mount. `useEffect` resets all state when `project` prop changes (opening dialog for different project). 962 lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] EmployeeCombobox custom filter for UUID value**
- **Found during:** Task 1 — implementation review
- **Issue:** cmdk `<Command>` default filter matches on the `value` prop (employee UUID). Searching for "Cohen" would never match because the value is a UUID string.
- **Fix:** Added `filter` prop to `<Command>` with a custom function that looks up the employee object by ID and matches against `first_name + last_name + employee_number`
- **Files modified:** EmployeeCombobox.tsx
- **Commit:** 316d88b (included in initial Task 1 commit)

**2. [Rule 2 - Missing Critical Functionality] Duplicate clock ID client-side validation**
- **Found during:** Task 2 — clock section implementation
- **Issue:** Without client-side check, submitting duplicate clock IDs would hit the DB unique constraint `attendance_clocks_project_clock_unique` with a raw Postgres error in Hebrew
- **Fix:** Added duplicate check in `handleSubmit` before logo upload and Server Action call — shows friendly `toast.error` with Hebrew message
- **Files modified:** ProjectForm.tsx
- **Commit:** d1438ff (included in Task 2 commit)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/components/admin/projects/EmployeeCombobox.tsx` | FOUND |
| `src/components/admin/projects/ProjectLocationPicker.tsx` | FOUND |
| `src/components/admin/projects/ProjectForm.tsx` | FOUND |
| EmployeeCombobox has `'use client'` | PASSED |
| ProjectLocationPicker has `'use client'` | PASSED |
| ProjectLocationPicker imports `leaflet/dist/leaflet.css` | PASSED |
| EmployeeCombobox uses Popover + Command pattern | PASSED |
| ProjectForm dynamic import of ProjectLocationPicker ssr:false | PASSED |
| ProjectForm has 3 EmployeeCombobox instances (PM, SM, CVC) | PASSED |
| ProjectForm has attendance_clocks JSON hidden input | PASSED |
| ProjectForm has all 7 sections | PASSED |
| ProjectForm min_lines: 400 | PASSED (962 lines) |
| `npx tsc --noEmit` passes | PASSED |
| commit 316d88b | FOUND |
| commit d1438ff | FOUND |
