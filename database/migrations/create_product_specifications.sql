-- Create product_specifications table for storing product attributes/specifications
CREATE TABLE IF NOT EXISTS public.product_specifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  specification_key text NOT NULL,
  specification_value text NOT NULL,
  data_type text DEFAULT 'text' CHECK (data_type IN ('text', 'number', 'boolean', 'select')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_product_specifications_product_id ON public.product_specifications(product_id);
CREATE INDEX IF NOT EXISTS idx_product_specifications_key_value ON public.product_specifications(specification_key, specification_value);

-- Enable Row Level Security
ALTER TABLE public.product_specifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow public read access
CREATE POLICY "Enable read access for all users" 
ON public.product_specifications 
FOR SELECT 
USING (true);

-- Allow authenticated users to insert/update/delete (admins only in practice)
CREATE POLICY "Enable insert for authenticated users" 
ON public.product_specifications 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
ON public.product_specifications 
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" 
ON public.product_specifications 
FOR DELETE 
USING (auth.role() = 'authenticated');
