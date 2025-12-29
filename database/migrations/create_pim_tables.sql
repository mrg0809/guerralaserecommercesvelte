-- =====================================================
-- PIM (Product Information Management) Tables
-- For Amazon, Mercado Libre, and SAT Integration
-- =====================================================

-- =====================================================
-- 1. SAT Product Information Table
-- =====================================================
-- Store Mexican SAT (Tax Authority) product information
CREATE TABLE IF NOT EXISTS public.sat_product_info (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  clave_prod_serv text NOT NULL CHECK (length(clave_prod_serv) = 8),
  clave_unidad text NOT NULL,
  unidad_medida text NOT NULL,
  material_peligroso boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(product_id)
);

-- Create indexes for SAT table
CREATE INDEX IF NOT EXISTS idx_sat_product_info_product_id ON public.sat_product_info(product_id);
CREATE INDEX IF NOT EXISTS idx_sat_product_info_clave_prod_serv ON public.sat_product_info(clave_prod_serv);

-- Enable Row Level Security
ALTER TABLE public.sat_product_info ENABLE ROW LEVEL SECURITY;

-- RLS policies for SAT table
CREATE POLICY "Enable read access for all users" 
ON public.sat_product_info 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON public.sat_product_info 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
ON public.sat_product_info 
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" 
ON public.sat_product_info 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- =====================================================
-- 2. Amazon Listings Table
-- =====================================================
-- Store Amazon-specific product listing information
CREATE TABLE IF NOT EXISTS public.amazon_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku_amazon text,
  asin text,
  feed_product_type text,
  bullet_points jsonb DEFAULT '[]'::jsonb,
  specific_attributes jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(product_id)
);

-- Create indexes for Amazon table
CREATE INDEX IF NOT EXISTS idx_amazon_listings_product_id ON public.amazon_listings(product_id);
CREATE INDEX IF NOT EXISTS idx_amazon_listings_sku_amazon ON public.amazon_listings(sku_amazon);
CREATE INDEX IF NOT EXISTS idx_amazon_listings_asin ON public.amazon_listings(asin);

-- Enable Row Level Security
ALTER TABLE public.amazon_listings ENABLE ROW LEVEL SECURITY;

-- RLS policies for Amazon table
CREATE POLICY "Enable read access for all users" 
ON public.amazon_listings 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON public.amazon_listings 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
ON public.amazon_listings 
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" 
ON public.amazon_listings 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- =====================================================
-- 3. Mercado Libre Listings Table
-- =====================================================
-- Store Mercado Libre-specific product listing information
CREATE TABLE IF NOT EXISTS public.mercadolibre_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ml_id text,
  listing_type text DEFAULT 'gold_special',
  attributes jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(product_id)
);

-- Create indexes for Mercado Libre table
CREATE INDEX IF NOT EXISTS idx_mercadolibre_listings_product_id ON public.mercadolibre_listings(product_id);
CREATE INDEX IF NOT EXISTS idx_mercadolibre_listings_ml_id ON public.mercadolibre_listings(ml_id);

-- Enable Row Level Security
ALTER TABLE public.mercadolibre_listings ENABLE ROW LEVEL SECURITY;

-- RLS policies for Mercado Libre table
CREATE POLICY "Enable read access for all users" 
ON public.mercadolibre_listings 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON public.mercadolibre_listings 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
ON public.mercadolibre_listings 
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" 
ON public.mercadolibre_listings 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- =====================================================
-- 4. Category Mappings Table (Template System)
-- =====================================================
-- Store category mapping templates for different platforms
CREATE TABLE IF NOT EXISTS public.category_mappings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  internal_type text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('amazon', 'mercadolibre', 'sat')),
  external_category_id text NOT NULL,
  external_category_name text,
  required_schema jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(internal_type, platform)
);

-- Create indexes for category mappings table
CREATE INDEX IF NOT EXISTS idx_category_mappings_internal_type ON public.category_mappings(internal_type);
CREATE INDEX IF NOT EXISTS idx_category_mappings_platform ON public.category_mappings(platform);
CREATE INDEX IF NOT EXISTS idx_category_mappings_type_platform ON public.category_mappings(internal_type, platform);

-- Enable Row Level Security
ALTER TABLE public.category_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for category mappings table
CREATE POLICY "Enable read access for all users" 
ON public.category_mappings 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON public.category_mappings 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
ON public.category_mappings 
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" 
ON public.category_mappings 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- =====================================================
-- Sample Data for Category Mappings (Optional)
-- =====================================================
-- Example template for a sensor product on Amazon
-- INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
-- VALUES (
--   'sensor',
--   'amazon',
--   'ce_automation_industrial_supplies',
--   'Industrial Sensors',
--   '{
--     "fields": [
--       {"name": "power_watts", "type": "number", "required": true, "label": "Power (Watts)"},
--       {"name": "voltage", "type": "number", "required": true, "label": "Voltage"},
--       {"name": "material", "type": "text", "required": false, "label": "Material"},
--       {"name": "color", "type": "select", "required": false, "label": "Color", "options": ["Black", "Silver", "Red"]}
--     ]
--   }'::jsonb
-- );

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE public.sat_product_info IS 'Mexican SAT (Tax Authority) product information for fiscal compliance';
COMMENT ON TABLE public.amazon_listings IS 'Amazon marketplace-specific product listing data';
COMMENT ON TABLE public.mercadolibre_listings IS 'Mercado Libre marketplace-specific product listing data';
COMMENT ON TABLE public.category_mappings IS 'Template system for mapping internal product types to external marketplace categories';

COMMENT ON COLUMN public.sat_product_info.clave_prod_serv IS 'SAT product/service code (8 digits)';
COMMENT ON COLUMN public.sat_product_info.clave_unidad IS 'SAT unit code';
COMMENT ON COLUMN public.sat_product_info.unidad_medida IS 'Unit of measurement description';
COMMENT ON COLUMN public.sat_product_info.material_peligroso IS 'Indicates if the product is hazardous material';

COMMENT ON COLUMN public.amazon_listings.sku_amazon IS 'Amazon-specific SKU identifier';
COMMENT ON COLUMN public.amazon_listings.asin IS 'Amazon Standard Identification Number';
COMMENT ON COLUMN public.amazon_listings.feed_product_type IS 'Amazon product feed type (e.g., Home, HomeImprovement)';
COMMENT ON COLUMN public.amazon_listings.bullet_points IS 'Array of product bullet points for Amazon listing';
COMMENT ON COLUMN public.amazon_listings.specific_attributes IS 'Dynamic attributes specific to the product category';

COMMENT ON COLUMN public.mercadolibre_listings.ml_id IS 'Mercado Libre listing ID';
COMMENT ON COLUMN public.mercadolibre_listings.listing_type IS 'Type of listing (e.g., gold_special, free)';
COMMENT ON COLUMN public.mercadolibre_listings.attributes IS 'Dynamic attributes specific to Mercado Libre category';

COMMENT ON COLUMN public.category_mappings.internal_type IS 'Internal product type identifier (e.g., sensor, laser, motor)';
COMMENT ON COLUMN public.category_mappings.platform IS 'Marketplace platform (amazon, mercadolibre, sat)';
COMMENT ON COLUMN public.category_mappings.external_category_id IS 'External platform category identifier';
COMMENT ON COLUMN public.category_mappings.required_schema IS 'JSON schema defining required fields for this category';
