-- Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create product_tags junction table
CREATE TABLE IF NOT EXISTS public.product_tags (                                                                                                                                                    
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
                                created_at timestamp with time zone DEFAULT timezone('ut                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               c'::text, now()) NOT NULL,
                                UNIQUE(product_id, tag_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS                                                                                                               idx_product_tags_product_id ON public.product_tags(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_tag_id ON public.product_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON public.tags(slug);
                                
-- Enable Row Level Security
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tags
CREATE POLICY "Enable read access for all users on tags" 
ON public.tags 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authenticated users on tags" 
ON public.tags 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Create RLS policies for product_tags
CREATE POLICY "Enable read access for all users on product_tags" 
ON public.product_tags 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authenticated users on product_tags" 
ON public.product_tags 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users on product_tags" 
ON public.product_tags 
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users on product_tags" 
ON public.product_tags 
FOR DELETE 
USING (auth.role() = 'authenticated');
