/**
 * schemas.ts
 *
 * Zod validation schemas for all admin entities.
 * All error messages are in Hebrew.
 * Used by Server Actions and React Hook Form via @hookform/resolvers/zod.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------
export const CompanySchema = z.object({
  name: z.string().min(1, 'שם חברה הוא שדה חובה'),
  internal_number: z.string().min(1, 'מספר חברה הוא שדה חובה'),
  company_reg_number: z.string().optional().or(z.literal('')),
  contact_name: z.string().optional().or(z.literal('')),
  contact_email: z
    .string()
    .email('כתובת מייל לא תקינה')
    .optional()
    .or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type CompanyInput = z.infer<typeof CompanySchema>

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------
export const DepartmentSchema = z.object({
  name: z.string().min(1, 'שם מחלקה הוא שדה חובה'),
  dept_number: z.string().min(1, 'מספר מחלקה הוא שדה חובה'),
  notes: z.string().optional().or(z.literal('')),
})

export type DepartmentInput = z.infer<typeof DepartmentSchema>
// Alias for clarity — same as DepartmentInput, no transform
export type DepartmentFormValues = DepartmentInput

// ---------------------------------------------------------------------------
// Role Tag
// ---------------------------------------------------------------------------
export const RoleTagSchema = z.object({
  name: z.string().min(1, 'שם תגית הוא שדה חובה'),
  description: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type RoleTagInput = z.infer<typeof RoleTagSchema>

// ---------------------------------------------------------------------------
// Employee
// ---------------------------------------------------------------------------
export const EmployeeSchema = z.object({
  first_name:              z.string().min(1, 'שם פרטי הוא שדה חובה'),
  last_name:               z.string().min(1, 'שם משפחה הוא שדה חובה'),
  employee_number:         z.string().min(1, 'מספר עובד הוא שדה חובה'),
  company_id:              z.string().uuid('חברה לא תקינה'),
  id_number:               z.string().optional().or(z.literal('')),
  gender:                  z.enum(['male', 'female', 'other']).optional(),
  street:                  z.string().optional().or(z.literal('')),
  house_number:            z.string().optional().or(z.literal('')),
  city:                    z.string().optional().or(z.literal('')),
  mobile_phone:            z.string().optional().or(z.literal('')),
  additional_phone:        z.string().optional().or(z.literal('')),
  email:                   z.string().optional().or(z.literal('')),
  date_of_birth:           z.string().optional().or(z.literal('')),
  start_date:              z.string().optional().or(z.literal('')),
  end_date:                z.string().optional().or(z.literal('')),
  status:                  z.enum(['active', 'suspended', 'inactive']).default('active'),
  department_id:           z.string().uuid().optional().or(z.literal('')),
  sub_department_id:       z.string().uuid().optional().or(z.literal('')),
  passport_number:         z.string().optional().or(z.literal('')),
  citizenship:             z.enum(['israeli', 'foreign']).optional(),
  correspondence_language: z.enum(['hebrew', 'english', 'arabic', 'thai']).default('hebrew'),
  profession:              z.string().optional().or(z.literal('')),
  notes:                   z.string().optional().or(z.literal('')),
  photo_url:               z.string().optional().or(z.literal('')),
  salary_system_license:   z.string().optional().or(z.literal('')),
})

export type EmployeeInput = z.infer<typeof EmployeeSchema>

// ---------------------------------------------------------------------------
// Role Template
// ---------------------------------------------------------------------------
export const TemplateSchema = z.object({
  name: z.string().min(1, 'שם תבנית הוא שדה חובה'),
  description: z.string().optional().or(z.literal('')),
})

export type TemplateInput = z.infer<typeof TemplateSchema>
