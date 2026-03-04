-- Migration: Fix RLS for shipping tables to support admin/superadmin roles from user_roles
-- Date: 2026-03-04
-- Description: Recreate policies using roles/user_roles instead of JWT-only app_metadata.role

-- Helper function to avoid recursive RLS checks against user_roles
CREATE OR REPLACE FUNCTION public.can_manage_shipping()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    auth.role() = 'service_role'
    OR COALESCE(public.user_has_role(auth.uid(), 'admin'), false)
    OR COALESCE(public.user_has_role(auth.uid(), 'superadmin'), false)
    OR COALESCE(public.user_has_role(auth.uid(), 'super_admin'), false)
  );
$$;

-- ============================================
-- shipping_types policies
-- ============================================
DROP POLICY IF EXISTS "Only admins can insert shipping types" ON shipping_types;
DROP POLICY IF EXISTS "Only admins can update shipping types" ON shipping_types;
DROP POLICY IF EXISTS "Only admins can delete shipping types" ON shipping_types;

CREATE POLICY "Only admins can insert shipping types"
  ON shipping_types
  FOR INSERT
  WITH CHECK (
    public.can_manage_shipping()
  );

CREATE POLICY "Only admins can update shipping types"
  ON shipping_types
  FOR UPDATE
  USING (
    public.can_manage_shipping()
  )
  WITH CHECK (
    public.can_manage_shipping()
  );

CREATE POLICY "Only admins can delete shipping types"
  ON shipping_types
  FOR DELETE
  USING (
    public.can_manage_shipping()
  );

-- ============================================
-- product_shipping_types policies
-- ============================================
DROP POLICY IF EXISTS "Only admins can insert product shipping types" ON product_shipping_types;
DROP POLICY IF EXISTS "Only admins can update product shipping types" ON product_shipping_types;
DROP POLICY IF EXISTS "Only admins can delete product shipping types" ON product_shipping_types;

CREATE POLICY "Only admins can insert product shipping types"
  ON product_shipping_types
  FOR INSERT
  WITH CHECK (
    public.can_manage_shipping()
  );

CREATE POLICY "Only admins can update product shipping types"
  ON product_shipping_types
  FOR UPDATE
  USING (
    public.can_manage_shipping()
  )
  WITH CHECK (
    public.can_manage_shipping()
  );

CREATE POLICY "Only admins can delete product shipping types"
  ON product_shipping_types
  FOR DELETE
  USING (
    public.can_manage_shipping()
  );
