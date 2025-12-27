-- =====================================================
-- Add price fields to Amazon and Mercado Libre tables
-- =====================================================
-- These fields allow different pricing per marketplace
-- to account for commission differences

-- Add price to Amazon Listings
ALTER TABLE public.amazon_listings 
ADD COLUMN IF NOT EXISTS price numeric(10,2);

-- Add price to Mercado Libre Listings
ALTER TABLE public.mercadolibre_listings 
ADD COLUMN IF NOT EXISTS price numeric(10,2);

-- Add comments to the columns
COMMENT ON COLUMN public.amazon_listings.price IS 'Price specific to Amazon marketplace (can be different from base_price to account for commissions)';
COMMENT ON COLUMN public.mercadolibre_listings.price IS 'Price specific to Mercado Libre marketplace (can be different from base_price to account for commissions)';

-- Create indexes for price filtering/sorting
CREATE INDEX IF NOT EXISTS idx_amazon_listings_price 
ON public.amazon_listings(price) WHERE price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mercadolibre_listings_price 
ON public.mercadolibre_listings(price) WHERE price IS NOT NULL;
