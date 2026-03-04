-- Migration: Create shipping types system without Envia.com dependency
-- Date: 2026-03-04
-- Description: Custom shipping types per product instead of using Envia.com API

-- Drop old tables if they exist (from previous implementation)
DROP TABLE IF EXISTS shipping_methods CASCADE;
DROP TABLE IF EXISTS quotation_requests CASCADE;

-- Create shipping_types table
CREATE TABLE IF NOT EXISTS shipping_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  carrier VARCHAR(50), -- 'fedex', 'dhl', 'estafeta', etc.
  service VARCHAR(100), -- 'standard', 'express', 'overnight', etc.
  base_price DECIMAL(10, 2) NOT NULL,
  estimated_days INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for active shipping types
CREATE INDEX IF NOT EXISTS idx_shipping_types_active ON shipping_types(is_active, display_order);

-- Add shipping_type_id column to products if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS shipping_type_id UUID REFERENCES shipping_types(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_shipping_type ON products(shipping_type_id);

-- Insert default shipping types
INSERT INTO shipping_types (name, description, carrier, service, base_price, estimated_days, display_order) VALUES
  ('FedEx Standard', 'Entrega en 2-3 días hábiles', 'fedex', 'standard', 250, 3, 1),
  ('FedEx Express', 'Entrega al día siguiente', 'fedex', 'express', 350, 1, 2),
  ('Envío Pesado', 'Para equipos grandes (Chillers, compresores, etc.)', 'fedex', 'heavy', 700, 5, 3),
  ('Cotización Personalizada', 'Requiere cotización manual (Maquinaria)', NULL, NULL, 0, 0, 0)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS on shipping_types
ALTER TABLE shipping_types ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if rerunning migration
DROP POLICY IF EXISTS "Anyone can read shipping types" ON shipping_types;
DROP POLICY IF EXISTS "Only admins can manage shipping types" ON shipping_types;
DROP POLICY IF EXISTS "Only admins can insert shipping types" ON shipping_types;
DROP POLICY IF EXISTS "Only admins can update shipping types" ON shipping_types;
DROP POLICY IF EXISTS "Only admins can delete shipping types" ON shipping_types;

-- Allow anyone to read shipping types
CREATE POLICY "Anyone can read shipping types"
  ON shipping_types
  FOR SELECT
  USING (true);

-- Only admins can insert shipping types
-- Requires JWT claim app_metadata.role = 'admin'
CREATE POLICY "Only admins can insert shipping types"
  ON shipping_types
  FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  );

-- Only admins can update shipping types
CREATE POLICY "Only admins can update shipping types"
  ON shipping_types
  FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  );

-- Only admins can delete shipping types
CREATE POLICY "Only admins can delete shipping types"
  ON shipping_types
  FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  );

-- Comments
COMMENT ON TABLE shipping_types IS 'Predefined shipping options available for products';
COMMENT ON COLUMN shipping_types.name IS 'Unique name of shipping type';
COMMENT ON COLUMN shipping_types.carrier IS 'Carrier name (fedex, dhl, estafeta, etc.)';
COMMENT ON COLUMN shipping_types.base_price IS 'Fixed price for this shipping option';
COMMENT ON COLUMN shipping_types.estimated_days IS 'Estimated delivery days';
COMMENT ON COLUMN products.shipping_type_id IS 'Reference to shipping_types table';
