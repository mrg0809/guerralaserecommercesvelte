-- =====================================================
-- Add browse_node_path to Amazon Listings Table
-- =====================================================
-- This field stores the Amazon category path (Browse Node)
-- Example: "Industria, Empresas y Ciencia›Hidráulica, Neumática y Plomería"

ALTER TABLE public.amazon_listings 
ADD COLUMN IF NOT EXISTS browse_node_path text;

-- Create index for browse_node_path for faster searches
CREATE INDEX IF NOT EXISTS idx_amazon_listings_browse_node 
ON public.amazon_listings(browse_node_path);

-- Add comment to the column
COMMENT ON COLUMN public.amazon_listings.browse_node_path IS 'Amazon category path (Browse Node) - Example: Industria, Empresas y Ciencia›Hidráulica, Neumática y Plomería';
