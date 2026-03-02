-- Create quotation_requests table to track shipping quotations for heavy items
CREATE TABLE IF NOT EXISTS public.quotation_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name varchar NOT NULL,
  customer_email varchar NOT NULL,
  customer_phone varchar,
  delivery_address_street varchar NOT NULL,
  delivery_address_city varchar NOT NULL,
  delivery_address_state varchar NOT NULL,
  delivery_address_zip varchar,
  delivery_address_country varchar DEFAULT 'MX',
  items jsonb NOT NULL, -- Cart items at time of quotation request
  estimated_subtotal decimal(12, 2),
  estimated_tax decimal(12, 2),
  notes text,
  status varchar DEFAULT 'pending', -- pending, quoted, accepted, rejected
  quoted_price decimal(12, 2), -- Final quoted shipping price
  quoted_at timestamp with time zone,
  expires_at timestamp with time zone, -- Quotation validity period
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotation_requests_user_id ON public.quotation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_quotation_requests_customer_email ON public.quotation_requests(customer_email);
CREATE INDEX IF NOT EXISTS idx_quotation_requests_status ON public.quotation_requests(status);
CREATE INDEX IF NOT EXISTS idx_quotation_requests_created_at ON public.quotation_requests(created_at DESC);

-- Enable RLS
ALTER TABLE public.quotation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own quotations
CREATE POLICY "Users can view their own quotations"
ON public.quotation_requests
FOR SELECT
USING (auth.uid() = user_id OR auth.role() = 'authenticated');

-- Users can insert their own quotations
CREATE POLICY "Users can insert their own quotations"
ON public.quotation_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR auth.role() = 'authenticated');

-- Only authenticated users (admins) can update quotations
CREATE POLICY "Authenticated users can update quotations"
ON public.quotation_requests
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated users (admins) can delete quotations
CREATE POLICY "Authenticated users can delete quotations"
ON public.quotation_requests
FOR DELETE
USING (auth.role() = 'authenticated');
