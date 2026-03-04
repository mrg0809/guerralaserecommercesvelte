-- Migration: Allow multiple shipping types per product
-- Date: 2026-03-04
-- Description: Create junction table product_shipping_types for many-to-many compatibility

CREATE TABLE IF NOT EXISTS product_shipping_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shipping_type_id UUID NOT NULL REFERENCES shipping_types(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, shipping_type_id)
);

CREATE INDEX IF NOT EXISTS idx_product_shipping_types_product_id
  ON product_shipping_types(product_id);

CREATE INDEX IF NOT EXISTS idx_product_shipping_types_shipping_type_id
  ON product_shipping_types(shipping_type_id);

-- Backfill existing single selection from products.shipping_type_id
INSERT INTO product_shipping_types (product_id, shipping_type_id)
SELECT p.id, p.shipping_type_id
FROM products p
WHERE p.shipping_type_id IS NOT NULL
ON CONFLICT (product_id, shipping_type_id) DO NOTHING;

ALTER TABLE product_shipping_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read product shipping types" ON product_shipping_types;
DROP POLICY IF EXISTS "Only admins can insert product shipping types" ON product_shipping_types;
DROP POLICY IF EXISTS "Only admins can update product shipping types" ON product_shipping_types;
DROP POLICY IF EXISTS "Only admins can delete product shipping types" ON product_shipping_types;

CREATE POLICY "Anyone can read product shipping types"
  ON product_shipping_types
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert product shipping types"
  ON product_shipping_types
  FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Only admins can update product shipping types"
  ON product_shipping_types
  FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Only admins can delete product shipping types"
  ON product_shipping_types
  FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  );

COMMENT ON TABLE product_shipping_types IS 'Shipping types compatible with each product (many-to-many)';
COMMENT ON COLUMN product_shipping_types.product_id IS 'Referenced product';
COMMENT ON COLUMN product_shipping_types.shipping_type_id IS 'Compatible shipping type';
