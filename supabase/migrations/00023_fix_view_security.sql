-- Fix driver_computed_status view security
-- Change from SECURITY DEFINER (publicly accessible) to SECURITY INVOKER
-- This makes the view respect RLS policies of underlying tables (drivers, employees)

ALTER VIEW driver_computed_status SET (security_invoker = on);
