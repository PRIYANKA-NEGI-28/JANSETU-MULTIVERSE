/*
# Security Hardening — Fix Audit Warnings

## Summary
Fixes four security warnings flagged by the Supabase security audit:
1. RLS policy `insert_complaints` on `public.complaints` had `WITH CHECK (true)` — unrestricted INSERT for anon + authenticated.
2. RLS policy `update_complaints` on `public.complaints` had `USING (true)` and `WITH CHECK (true)` — unrestricted UPDATE for authenticated.
3. Function `public.generate_complaint_number()` was `SECURITY DEFINER` and executable by `anon`.
4. Function `public.generate_complaint_number()` was `SECURITY DEFINER` and executable by `authenticated`.

(The fifth warning — leaked password protection / HaveIBeenPwned — is an Auth config setting that must be toggled in the Supabase Dashboard under Authentication > Settings, as it is not exposed via SQL or the migrations API.)

## Changes

### 1. complaints table — RLS policies (replaced)
The `complaints` table has a `user_id uuid` column (FK to `auth.users`) added in a prior migration. The app has a sign-in screen (UserAuth.tsx), so complaints are owner-scoped. The old policies used `WITH CHECK (true)` / `USING (true)` which bypassed RLS entirely.

New policies:
- **select_complaints**: `TO anon, authenticated` — all complaints are public (citizens can track any complaint by number), so SELECT stays open. This is intentional: complaint tracking is a public-facing feature.
- **insert_complaints**: `TO authenticated` — only signed-in users can file complaints; `WITH CHECK (auth.uid() = user_id)` enforces ownership. The `user_id` column already defaults to `auth.uid()` (set in prior migration), so inserts that omit `user_id` still satisfy the check.
- **update_complaints**: `TO authenticated` — only the owner can update their own complaint's status fields; `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)`.
- **delete_complaints**: `TO authenticated` — only the owner can delete their own complaint.
- **delete_complaints_service_role**: kept as-is for the service_role (admin operations).

Note: anon can SELECT but cannot INSERT/UPDATE/DELETE. This matches the app flow — anonymous browsing/tracking is allowed, but filing requires sign-in.

### 2. generate_complaint_number() — SECURITY INVOKER + revoke EXECUTE
The function is a simple deterministic generator (`'JS-' || date || random 4-digit`). It does not touch any tables and has no privileged side effects, so `SECURITY DEFINER` is unnecessary. Switched to `SECURITY INVOKER` and revoked EXECUTE from `anon` and `authenticated` so it cannot be called via the REST RPC endpoint by unauthenticated or authenticated users. It is still callable internally as a column DEFAULT (column defaults run with table-owner privileges, not via RPC).

## Security Impact
- INSERT/UPDATE/DELETE on `complaints` now require an authenticated session AND ownership (`auth.uid() = user_id`). Anonymous users can only SELECT.
- `generate_complaint_number()` is no longer callable via REST RPC by any client role; it only runs as a column default during INSERT.
*/

-- ─── 1. complaints RLS policies ────────────────────────────────────────────
-- Drop the overly-permissive policies first.
DROP POLICY IF EXISTS "select_complaints" ON public.complaints;
DROP POLICY IF EXISTS "insert_complaints" ON public.complaints;
DROP POLICY IF EXISTS "update_complaints" ON public.complaints;
DROP POLICY IF EXISTS "delete_complaints" ON public.complaints;
-- (delete_complaints_service_role is intentionally kept for admin operations.)

-- SELECT: complaints are publicly trackable by complaint number — intentional public read.
CREATE POLICY "select_complaints"
  ON public.complaints FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: only signed-in owners can file, and the row must belong to them.
CREATE POLICY "insert_complaints"
  ON public.complaints FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: only the owner can update their own complaint.
CREATE POLICY "update_complaints"
  ON public.complaints FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: only the owner can delete their own complaint.
CREATE POLICY "delete_complaints"
  ON public.complaints FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── 2. generate_complaint_number() — SECURITY INVOKER + revoke EXECUTE ────
CREATE OR REPLACE FUNCTION public.generate_complaint_number()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN 'JS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9999 + 1)::text, 4, '0');
END;
$function$;

-- Revoke direct execution from client roles; the function still works as a column DEFAULT.
REVOKE EXECUTE ON FUNCTION public.generate_complaint_number() FROM anon, authenticated;
