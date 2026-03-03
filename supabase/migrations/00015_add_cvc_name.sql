-- =============================================================================
-- Migration: 00015_add_cvc_name.sql
-- Phase:     04 — Projects (fix)
-- Purpose:   Add cvc_name column for free-text CVC entry (name + phone).
--            When cvc_is_employee = false, both cvc_name and cvc_phone are used.
--
-- Run via: Supabase Dashboard → SQL Editor
-- =============================================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS cvc_name TEXT;
