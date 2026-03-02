-- Add shipping_type column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS shipping_type_id uuid REFERENCES public.shipping_types(id) ON DELETE SET NULL;

-- Create index on shipping_type_id
CREATE INDEX IF NOT EXISTS idx_products_shipping_type_id ON public.products(shipping_type_id);

-- Classify existing products based on their category
-- First, get the ID for 'heavy' shipping type and update machinery products
UPDATE public.products p
SET shipping_type_id = (SELECT id FROM public.shipping_types WHERE name = 'heavy')
WHERE p.category_id IN (
  -- Select all machinery categories and their descendants
  SELECT c.id FROM public.categories c
  WHERE c.slug IN (
    'maquinaria', 'maquinas-laser', 'laser-co2', 'laser-fibra', 
    'maquina-laser-co2', 'maquina-laser-fibra', 'router-cnc', 'cnc-router',
    'maquina-router', 'cnc-plasma', 'plasma', 'tornos', 'centros-maquinado',
    'dobladora-acrilico', 'dobladora', 'chillers', 'chiller', 'compresores',
    'compresor', 'extractores', 'extractor', 'chillers-compresores-extractores',
    'bombas', 'bomba', 'bomba-agua'
  )
  OR c.parent_id IN (
    SELECT id FROM public.categories WHERE slug IN (
      'maquinaria', 'maquinas-laser', 'laser-co2', 'laser-fibra',
      'maquina-laser-co2', 'maquina-laser-fibra', 'router-cnc', 'cnc-router',
      'maquina-router', 'cnc-plasma', 'plasma', 'tornos', 'centros-maquinado',
      'dobladora-acrilico', 'dobladora', 'chillers', 'chiller', 'compresores',
      'compresor', 'extractores', 'extractor', 'chillers-compresores-extractores',
      'bombas', 'bomba', 'bomba-agua'
    )
  )
);

-- Update delicate items (laser tubes)
UPDATE public.products p
SET shipping_type_id = (SELECT id FROM public.shipping_types WHERE name = 'delicate')
WHERE p.category_id IN (
  SELECT c.id FROM public.categories c
  WHERE c.slug IN (
    'tubos-laser', 'tubo-laser', 'tubos', 'tubo-co2', 'tubo-rf'
  )
  OR c.parent_id IN (
    SELECT id FROM public.categories WHERE slug IN (
      'tubos-laser', 'tubo-laser', 'tubos', 'tubo-co2', 'tubo-rf'
    )
  )
)
AND shipping_type_id IS NULL;

-- Update standard items (everything else that doesn't have a type yet)
UPDATE public.products p
SET shipping_type_id = (SELECT id FROM public.shipping_types WHERE name = 'standard')
WHERE p.shipping_type_id IS NULL;
