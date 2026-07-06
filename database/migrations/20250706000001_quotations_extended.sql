-- Campos extendidos para cotizaciones (manual, asistente IA, chat IA)

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS installation_cost DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS source VARCHAR(32) DEFAULT 'manual';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS prices_exclude_iva BOOLEAN DEFAULT false;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS include_all_details BOOLEAN DEFAULT false;

-- Compatibilidad: renombrar total → total_amount si aplica
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'total'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE quotations RENAME COLUMN total TO total_amount;
  END IF;
END $$;

-- Copiar total_amount desde total si quedó nulo
UPDATE quotations SET total_amount = subtotal WHERE total_amount IS NULL;

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS detail_description TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS include_detail BOOLEAN DEFAULT false;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS catalog_detail TEXT;

CREATE INDEX IF NOT EXISTS idx_quotations_source ON quotations(source);

COMMENT ON COLUMN quotations.source IS 'manual | ai_assistant | ai_chat';
