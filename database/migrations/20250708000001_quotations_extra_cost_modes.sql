-- Modo de envío e instalación: cost | included | na

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipping_mode VARCHAR(16) DEFAULT 'na';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS installation_mode VARCHAR(16) DEFAULT 'na';

UPDATE quotations
SET shipping_mode = 'cost'
WHERE shipping_cost > 0 AND (shipping_mode IS NULL OR shipping_mode = 'na');

UPDATE quotations
SET installation_mode = 'cost'
WHERE installation_cost > 0 AND (installation_mode IS NULL OR installation_mode = 'na');

COMMENT ON COLUMN quotations.shipping_mode IS 'cost | included | na';
COMMENT ON COLUMN quotations.installation_mode IS 'cost | included | na';
