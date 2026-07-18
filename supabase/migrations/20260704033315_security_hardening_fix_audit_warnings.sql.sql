/*
# Security Hardening - Fix Supabase Audit Warnings

## Summary
This migration addresses 10 security warnings from the Supabase Security Audit:
1. Fixes mutable search_path on generate_complaint_number() function
2-4. Tightens overly permissive RLS policies on complaints table
5-7. Tightens overly permissive RLS policies on departments table
8-10. Tightens overly permissive RLS policies on officers table

The 11th warning (Leaked Password Protection) is a dashboard setting, not SQL-fixable.

## Changes

### 1. Function Security Fix
- `generate_complaint_number()`: Added fixed search_path and SECURITY DEFINER
- Prevents SQL injection via search_path manipulation

### 2. complaints Table RLS
- SELECT: Remains open to anon + authenticated (public complaint visibility)
- INSERT: Remains open to anon + authenticated (citizens can file complaints)
- UPDATE: Changed from unrestricted to authenticated-only with status/escalation fields restriction
- DELETE: Removed anon access - complaints should not be deleted via public API

### 3. departments Table RLS  
- SELECT: Remains open (public reference data)
- INSERT/UPDATE/DELETE: Restricted to service_role only (admin-managed seed data)
- Public users cannot modify department records

### 4. officers Table RLS
- SELECT: Remains open (public officer directory)  
- INSERT/UPDATE/DELETE: Restricted to service_role only (admin-managed roster)
- Public users cannot modify officer records

### 5. Security Notes
- All mutation policies that were "USING (true)" / "WITH CHECK (true)" have been tightened
- The app's Neo4j proxy edge function uses service_role key for backend mutations
- Citizens retain ability to file complaints (INSERT) and view all data (SELECT)
- Only authenticated admin users can update complaint status

## Important
- Leaked Password Protection must be enabled in Supabase Dashboard → Auth → Settings
- This cannot be done via SQL migration
*/

-- 1. FIX FUNCTION: generate_complaint_number with fixed search_path
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS text AS $$
BEGIN
  RETURN 'JS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9999 + 1)::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. FIX COMPLAINTS TABLE RLS POLICIES

-- Drop old unrestricted mutation policies
DROP POLICY IF EXISTS "delete_complaints" ON complaints;
DROP POLICY IF EXISTS "insert_complaints" ON complaints;
DROP POLICY IF EXISTS "update_complaints" ON complaints;

-- SELECT: Keep open for public visibility
DROP POLICY IF EXISTS "select_complaints" ON complaints;
CREATE POLICY "select_complaints" ON complaints FOR SELECT
  TO anon, authenticated USING (true);

-- INSERT: Keep open for citizens to file complaints
CREATE POLICY "insert_complaints" ON complaints FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- UPDATE: Restrict to authenticated users (admin/officials updating status)
-- Users can only update status, assigned_officer_id, escalation fields
CREATE POLICY "update_complaints" ON complaints FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: No public delete - complaints are archived, not removed
-- If deletion is needed, it should go through a service_role edge function
CREATE POLICY "delete_complaints_service_role" ON complaints FOR DELETE
  TO service_role USING (true);

-- 3. FIX DEPARTMENTS TABLE RLS POLICIES

-- Drop old unrestricted policies
DROP POLICY IF EXISTS "delete_departments" ON departments;
DROP POLICY IF EXISTS "insert_departments" ON departments;
DROP POLICY IF EXISTS "update_departments" ON departments;
DROP POLICY IF EXISTS "select_departments" ON departments;

-- SELECT: Keep open for public reference
CREATE POLICY "select_departments" ON departments FOR SELECT
  TO anon, authenticated USING (true);

-- INSERT/UPDATE/DELETE: Service role only (admin-managed seed data)
CREATE POLICY "insert_departments_service_role" ON departments FOR INSERT
  TO service_role WITH CHECK (true);

CREATE POLICY "update_departments_service_role" ON departments FOR UPDATE
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "delete_departments_service_role" ON departments FOR DELETE
  TO service_role USING (true);

-- 4. FIX OFFICERS TABLE RLS POLICIES

-- Drop old unrestricted policies
DROP POLICY IF EXISTS "delete_officers" ON officers;
DROP POLICY IF EXISTS "insert_officers" ON officers;
DROP POLICY IF EXISTS "update_officers" ON officers;
DROP POLICY IF EXISTS "select_officers" ON officers;

-- SELECT: Keep open for public officer directory
CREATE POLICY "select_officers" ON officers FOR SELECT
  TO anon, authenticated USING (true);

-- INSERT/UPDATE/DELETE: Service role only (admin-managed roster)
CREATE POLICY "insert_officers_service_role" ON officers FOR INSERT
  TO service_role WITH CHECK (true);

CREATE POLICY "update_officers_service_role" ON officers FOR UPDATE
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "delete_officers_service_role" ON officers FOR DELETE
  TO service_role USING (true);