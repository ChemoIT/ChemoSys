-- =============================================================================
-- Migration: 00001_foundation_schema.sql
-- Phase:     01 — Foundation
-- Purpose:   All Phase 1 tables with universal columns, soft-delete partial
--            indexes, auto-update triggers, and the SECURITY DEFINER helper.
-- Run via:   Supabase Dashboard → SQL Editor, or `supabase db push`
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SHARED TRIGGER FUNCTION
-- Fires BEFORE UPDATE on every table that has an updated_at column.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CORE REFERENCE TABLES  (Phase 1 — actively managed by admin UI)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. companies
-- ---------------------------------------------------------------------------
CREATE TABLE companies (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name                 TEXT        NOT NULL,
  internal_number      TEXT        NOT NULL,
  company_reg_number   TEXT,                          -- ח.פ.
  contact_name         TEXT,
  contact_email        TEXT,
  notes                TEXT,
  -- Universal columns
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ DEFAULT NULL               -- NULL = active
);

-- Partial unique index: uniqueness enforced only among non-deleted records.
-- A plain UNIQUE constraint would fire even on soft-deleted rows (Pitfall 5).
CREATE UNIQUE INDEX companies_internal_number_active
  ON companies (internal_number)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. departments
-- ---------------------------------------------------------------------------
CREATE TABLE departments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  dept_number     TEXT NOT NULL,
  company_id      UUID REFERENCES companies(id) NOT NULL,
  parent_dept_id  UUID REFERENCES departments(id),   -- NULL = top-level department
  notes           TEXT,
  -- Universal columns
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

-- Unique department number per company, active records only
CREATE UNIQUE INDEX departments_number_company_active
  ON departments (dept_number, company_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. role_tags
-- ---------------------------------------------------------------------------
CREATE TABLE role_tags (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  notes        TEXT,
  -- Universal columns
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

CREATE UNIQUE INDEX role_tags_name_active
  ON role_tags (name)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_role_tags_updated_at
  BEFORE UPDATE ON role_tags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. modules  (permission system seed table — system-managed, not user-editable)
-- ---------------------------------------------------------------------------
CREATE TABLE modules (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  key         TEXT    NOT NULL UNIQUE,
  name_he     TEXT    NOT NULL,
  parent_key  TEXT,                          -- NULL = top-level module
  sort_order  INT     NOT NULL DEFAULT 0,
  icon        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
  -- No soft delete — system table. No updated_at — read-only after seed.
);

-- ---------------------------------------------------------------------------
-- 5. audit_log  (immutable record — no soft delete, no update)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id      UUID REFERENCES auth.users(id),
  action       TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')),
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   TEXT,
  user_agent   TEXT
  -- No deleted_at — audit_log is the immutable historical record.
  -- No updated_at — entries are never modified.
);

-- Indexes for common audit queries
CREATE INDEX idx_audit_log_user   ON audit_log (user_id,    created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_log_date   ON audit_log (created_at DESC);

-- =============================================================================
-- FUTURE-PROOFING STUBS  (Phase 2+ tables — created now so FKs are ready)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 6. employees
-- ---------------------------------------------------------------------------
CREATE TABLE employees (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name                TEXT NOT NULL,
  last_name                 TEXT NOT NULL,
  employee_number           TEXT NOT NULL,
  company_id                UUID REFERENCES companies(id) NOT NULL,
  id_number                 TEXT,                         -- ת.ז.
  gender                    TEXT CHECK (gender IN ('male', 'female', 'other')),
  street                    TEXT,
  house_number              TEXT,
  city                      TEXT,
  mobile_phone              TEXT,
  additional_phone          TEXT,
  email                     TEXT,
  date_of_birth             DATE,
  start_date                DATE,
  end_date                  DATE,
  status                    TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'suspended', 'inactive')),
  department_id             UUID REFERENCES departments(id),
  sub_department_id         UUID REFERENCES departments(id),
  passport_number           TEXT,
  citizenship               TEXT CHECK (citizenship IN ('israeli', 'foreign')),
  correspondence_language   TEXT DEFAULT 'hebrew'
                              CHECK (correspondence_language IN ('hebrew', 'english', 'arabic', 'thai')),
  profession                TEXT,
  notes                     TEXT,
  -- Universal columns
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

CREATE UNIQUE INDEX employees_number_company_active
  ON employees (employee_number, company_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. employee_role_tags  (junction: employees ↔ role_tags)
-- ---------------------------------------------------------------------------
CREATE TABLE employee_role_tags (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id  UUID REFERENCES employees(id) NOT NULL,
  role_tag_id  UUID REFERENCES role_tags(id) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
  -- No soft delete on junction — simply delete the row to remove the tag.
);

CREATE UNIQUE INDEX employee_role_tags_unique
  ON employee_role_tags (employee_id, role_tag_id);

-- ---------------------------------------------------------------------------
-- 8. role_templates  (permission role templates — used in Phase 3)
-- ---------------------------------------------------------------------------
CREATE TABLE role_templates (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  notes        TEXT,
  -- Universal columns
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

CREATE UNIQUE INDEX role_templates_name_active
  ON role_templates (name)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_role_templates_updated_at
  BEFORE UPDATE ON role_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. template_permissions  (module-level permission levels per template)
-- ---------------------------------------------------------------------------
CREATE TABLE template_permissions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id  UUID REFERENCES role_templates(id) NOT NULL,
  module_key   TEXT NOT NULL,
  level        SMALLINT NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 2),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
  -- No soft delete — update or delete the row to change template permissions.
);

CREATE UNIQUE INDEX template_permissions_unique
  ON template_permissions (template_id, module_key);

-- ---------------------------------------------------------------------------
-- 10. users  (admin system users — wraps auth.users, not a replacement)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id  UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  employee_id   UUID REFERENCES employees(id) NOT NULL,
  is_blocked    BOOLEAN DEFAULT FALSE,
  notes         TEXT,
  -- Universal columns
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. user_permissions  (per-user module access levels, with optional template)
-- ---------------------------------------------------------------------------
CREATE TABLE user_permissions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES users(id) NOT NULL,
  module_key   TEXT NOT NULL,
  level        SMALLINT NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 2),
  template_id  UUID REFERENCES role_templates(id),
  is_override  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
  -- No soft delete — update or delete permission rows directly.
);

CREATE UNIQUE INDEX user_permissions_unique
  ON user_permissions (user_id, module_key);

CREATE TRIGGER trigger_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 12. projects
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
  id                           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                         TEXT NOT NULL,
  display_name                 TEXT,
  project_number               TEXT NOT NULL,
  expense_number               TEXT,
  general_number               TEXT,
  description                  TEXT,
  project_code                 TEXT,
  attendance_code              TEXT,
  has_attendance_code          BOOLEAN DEFAULT FALSE,
  project_type                 TEXT CHECK (project_type IN ('project', 'staging_area', 'storage_area')),
  ignore_auto_equipment        BOOLEAN DEFAULT FALSE,
  supervision                  TEXT,
  client                       TEXT,
  status                       TEXT NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'inactive')),
  project_manager_id           UUID REFERENCES employees(id),
  pm_email                     TEXT,
  pm_phone                     TEXT,
  pm_notifications             BOOLEAN DEFAULT TRUE,
  site_manager_id              UUID REFERENCES employees(id),
  sm_email                     TEXT,
  sm_phone                     TEXT,
  sm_notifications             BOOLEAN DEFAULT TRUE,
  camp_vehicle_coordinator_id  UUID REFERENCES employees(id),
  cvc_phone                    TEXT,
  latitude                     DECIMAL,
  longitude                    DECIMAL,
  -- Universal columns
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

CREATE UNIQUE INDEX projects_number_active
  ON projects (project_number)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- SECURITY DEFINER FUNCTION
-- Used in Phase 3 permission lookups. Defined here so the function exists
-- before RLS policies reference it. SECURITY DEFINER prevents RLS recursion
-- on the user_permissions table (Pitfall 4).
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(module_key TEXT, level SMALLINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.module_key, up.level
  FROM user_permissions up
  INNER JOIN users u ON u.id = up.user_id
  WHERE u.auth_user_id = p_user_id;
$$;
