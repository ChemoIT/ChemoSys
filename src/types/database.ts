/**
 * database.ts
 *
 * Manually-typed Database interface mirroring the Supabase PostgreSQL schema
 * defined in supabase/migrations/00001_foundation_schema.sql.
 *
 * Pattern: Each table entry exposes Row, Insert, and Update sub-types so
 * callers have compile-time safety for every DB operation.
 *
 *   Row    — shape returned by SELECT (all columns, nulls explicit)
 *   Insert — what the caller provides on INSERT (auto-cols optional)
 *   Update — Partial<Insert> for PATCH-style mutations
 *
 * Keep in sync with migrations manually until Phase 2, when `supabase gen types`
 * can be wired into CI for automatic regeneration.
 */

export interface Database {
  public: {
    Tables: {
      // -----------------------------------------------------------------------
      // companies
      // -----------------------------------------------------------------------
      companies: {
        Row: {
          id: string
          name: string
          internal_number: string
          company_reg_number: string | null
          contact_name: string | null
          contact_email: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          internal_number: string
          company_reg_number?: string | null
          contact_name?: string | null
          contact_email?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }

      // -----------------------------------------------------------------------
      // departments
      // -----------------------------------------------------------------------
      departments: {
        Row: {
          id: string
          name: string
          dept_number: string
          company_id: string
          parent_dept_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          dept_number: string
          company_id: string
          parent_dept_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['departments']['Insert']>
      }

      // -----------------------------------------------------------------------
      // role_tags
      // -----------------------------------------------------------------------
      role_tags: {
        Row: {
          id: string
          name: string
          description: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['role_tags']['Insert']>
      }

      // -----------------------------------------------------------------------
      // modules (system table — seeded, read-only after migration)
      // -----------------------------------------------------------------------
      modules: {
        Row: {
          id: string
          key: string
          name_he: string
          parent_key: string | null
          sort_order: number
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          name_he: string
          parent_key?: string | null
          sort_order?: number
          icon?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['modules']['Insert']>
      }

      // -----------------------------------------------------------------------
      // audit_log (immutable record — INSERT only after creation)
      // -----------------------------------------------------------------------
      audit_log: {
        Row: {
          id: string
          created_at: string
          user_id: string | null
          action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT'
          entity_type: string
          entity_id: string | null
          old_data: Record<string, unknown> | null
          new_data: Record<string, unknown> | null
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id?: string | null
          action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT'
          entity_type: string
          entity_id?: string | null
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>
      }

      // -----------------------------------------------------------------------
      // employees (Phase 2 — stub created for FK readiness)
      // -----------------------------------------------------------------------
      employees: {
        Row: {
          id: string
          first_name: string
          last_name: string
          employee_number: string
          company_id: string
          id_number: string | null
          gender: 'male' | 'female' | 'other' | null
          street: string | null
          house_number: string | null
          city: string | null
          mobile_phone: string | null
          additional_phone: string | null
          email: string | null
          date_of_birth: string | null
          start_date: string | null
          end_date: string | null
          status: 'active' | 'suspended' | 'inactive'
          department_id: string | null
          sub_department_id: string | null
          passport_number: string | null
          citizenship: 'israeli' | 'foreign' | null
          correspondence_language: 'hebrew' | 'english' | 'arabic' | 'thai' | null
          profession: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          employee_number: string
          company_id: string
          id_number?: string | null
          gender?: 'male' | 'female' | 'other' | null
          street?: string | null
          house_number?: string | null
          city?: string | null
          mobile_phone?: string | null
          additional_phone?: string | null
          email?: string | null
          date_of_birth?: string | null
          start_date?: string | null
          end_date?: string | null
          status?: 'active' | 'suspended' | 'inactive'
          department_id?: string | null
          sub_department_id?: string | null
          passport_number?: string | null
          citizenship?: 'israeli' | 'foreign' | null
          correspondence_language?: 'hebrew' | 'english' | 'arabic' | 'thai' | null
          profession?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }

      // -----------------------------------------------------------------------
      // employee_role_tags (junction — Phase 2)
      // -----------------------------------------------------------------------
      employee_role_tags: {
        Row: {
          id: string
          employee_id: string
          role_tag_id: string
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          role_tag_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['employee_role_tags']['Insert']>
      }

      // -----------------------------------------------------------------------
      // role_templates (Phase 3 — stub created for FK readiness)
      // -----------------------------------------------------------------------
      role_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['role_templates']['Insert']>
      }

      // -----------------------------------------------------------------------
      // template_permissions (Phase 3)
      // -----------------------------------------------------------------------
      template_permissions: {
        Row: {
          id: string
          template_id: string
          module_key: string
          level: number
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          module_key: string
          level?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['template_permissions']['Insert']>
      }

      // -----------------------------------------------------------------------
      // users (Phase 3 — wraps auth.users, not a replacement)
      // -----------------------------------------------------------------------
      users: {
        Row: {
          id: string
          auth_user_id: string
          employee_id: string
          is_blocked: boolean
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          auth_user_id: string
          employee_id: string
          is_blocked?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }

      // -----------------------------------------------------------------------
      // user_permissions (Phase 3)
      // -----------------------------------------------------------------------
      user_permissions: {
        Row: {
          id: string
          user_id: string
          module_key: string
          level: number
          template_id: string | null
          is_override: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          module_key: string
          level?: number
          template_id?: string | null
          is_override?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_permissions']['Insert']>
      }

      // -----------------------------------------------------------------------
      // projects (Phase 4 — stub created for FK readiness)
      // -----------------------------------------------------------------------
      projects: {
        Row: {
          id: string
          name: string
          display_name: string | null
          project_number: string
          expense_number: string | null
          general_number: string | null
          description: string | null
          project_code: string | null
          attendance_code: string | null
          has_attendance_code: boolean
          project_type: 'project' | 'staging_area' | 'storage_area' | null
          ignore_auto_equipment: boolean
          supervision: string | null
          client: string | null
          status: 'active' | 'inactive'
          project_manager_id: string | null
          pm_email: string | null
          pm_phone: string | null
          pm_notifications: boolean
          site_manager_id: string | null
          sm_email: string | null
          sm_phone: string | null
          sm_notifications: boolean
          camp_vehicle_coordinator_id: string | null
          cvc_phone: string | null
          latitude: number | null
          longitude: number | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          display_name?: string | null
          project_number: string
          expense_number?: string | null
          general_number?: string | null
          description?: string | null
          project_code?: string | null
          attendance_code?: string | null
          has_attendance_code?: boolean
          project_type?: 'project' | 'staging_area' | 'storage_area' | null
          ignore_auto_equipment?: boolean
          supervision?: string | null
          client?: string | null
          status?: 'active' | 'inactive'
          project_manager_id?: string | null
          pm_email?: string | null
          pm_phone?: string | null
          pm_notifications?: boolean
          site_manager_id?: string | null
          sm_email?: string | null
          sm_phone?: string | null
          sm_notifications?: boolean
          camp_vehicle_coordinator_id?: string | null
          cvc_phone?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
    }
  }
}
