-- Create shipping_types table for parametrizable shipping configuration
CREATE TABLE IF NOT EXISTS public.shipping_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar NOT NULL UNIQUE, -- 'standard', 'delicate', 'heavy'
  description text,
  is_active boolean DEFAULT true,
  requires_quotation boolean DEFAULT false, -- true for 'heavy' type
  requires_special_handling boolean DEFAULT false, -- true for 'delicate' type
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create shipping_methods table to store carrier options per shipping_type
CREATE TABLE IF NOT EXISTS public.shipping_methods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shipping_type_id uuid NOT NULL REFERENCES public.shipping_types(id) ON DELETE CASCADE,
  name varchar NOT NULL, -- 'FedEx Standard', 'FedEx Express', etc.
  carrier varchar NOT NULL, -- 'fedex', 'dhl', 'local', etc.
  description text,
  base_price decimal(10, 2) NOT NULL, -- in MXN
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shipping_types_name ON public.shipping_types(name);
CREATE INDEX IF NOT EXISTS idx_shipping_types_is_active ON public.shipping_types(is_active);
CREATE INDEX IF NOT EXISTS idx_shipping_methods_shipping_type_id ON public.shipping_methods(shipping_type_id);
CREATE INDEX IF NOT EXISTS idx_shipping_methods_is_active ON public.shipping_methods(is_active);

-- Enable RLS
ALTER TABLE public.shipping_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shipping_types
CREATE POLICY "Enable read access for all users"
ON public.shipping_types
FOR SELECT
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.shipping_types
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users"
ON public.shipping_types
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users"
ON public.shipping_types
FOR DELETE
USING (auth.role() = 'authenticated');

-- RLS Policies for shipping_methods
CREATE POLICY "Enable read access for all users"
ON public.shipping_methods
FOR SELECT
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.shipping_methods
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users"
ON public.shipping_methods
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users"
ON public.shipping_methods
FOR DELETE
USING (auth.role() = 'authenticated');

-- Seed default shipping types and methods
INSERT INTO public.shipping_types (name, description, is_active, requires_quotation, requires_special_handling)
VALUES
  ('standard', 'Standard shipping for parts and consumables', true, false, false),
  ('delicate', 'Delicate items with special handling (laser tubes)', true, false, true),
  ('heavy', 'Heavy machinery requiring manual quotation', true, true, false)
ON CONFLICT (name) DO NOTHING;

-- Seed default shipping methods for standard type
INSERT INTO public.shipping_methods (shipping_type_id, name, carrier, description, base_price, is_active, display_order)
SELECT id, 'FedEx Standard', 'fedex', 'Standard FedEx delivery', 250.00, true, 1
FROM public.shipping_types WHERE name = 'standard'
ON CONFLICT DO NOTHING;

INSERT INTO public.shipping_methods (shipping_type_id, name, carrier, description, base_price, is_active, display_order)
SELECT id, 'FedEx Express', 'fedex', 'Express FedEx delivery', 350.00, true, 2
FROM public.shipping_types WHERE name = 'standard'
ON CONFLICT DO NOTHING;

-- Seed default shipping methods for delicate type
INSERT INTO public.shipping_methods (shipping_type_id, name, carrier, description, base_price, is_active, display_order)
SELECT id, 'Special Packaging + Courier', 'local', 'Special packaging and central delivery', 350.00, true, 1
FROM public.shipping_types WHERE name = 'delicate'
ON CONFLICT DO NOTHING;
