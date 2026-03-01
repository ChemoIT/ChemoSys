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
