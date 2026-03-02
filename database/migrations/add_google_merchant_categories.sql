-- =====================================================
-- Google Merchant Center Category Mapping
-- Agrega campos para mapear categorías internas a Google
-- =====================================================

-- Agregar campos de Google Merchant a la tabla categories
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS google_category_id VARCHAR(10),
ADD COLUMN IF NOT EXISTS google_category_name VARCHAR(255);

-- Crear índice para mejorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_categories_google_category_id 
ON categories(google_category_id);

-- Agregar comentarios para documentación
COMMENT ON COLUMN categories.google_category_id IS 'ID numérico de categoría de Google Merchant Center (ej: 8092 para Laser Cutters)';
COMMENT ON COLUMN categories.google_category_name IS 'Nombre de la categoría de Google Merchant Center';

-- =====================================================
-- Mapeos de Categorías Principales
-- Basado en: https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
-- =====================================================

-- Máquinas Láser CO2 y Fibra Óptica
UPDATE categories 
SET 
  google_category_id = '8092',
  google_category_name = 'Business & Industrial > Manufacturing > Laser Cutters'
WHERE slug IN ('maquinaria', 'maquinas-laser', 'laser-co2', 'laser-fibra', 'maquina-laser-co2', 'maquina-laser-fibra');

-- Máquinas Router CNC
UPDATE categories 
SET 
  google_category_id = '3086',
  google_category_name = 'Business & Industrial > Woodworking Machinery & Equipment > Wood Routers'
WHERE slug IN ('router-cnc', 'cnc-router', 'maquina-router');

-- Máquinas CNC Plasma y otros equipos de manufactura
UPDATE categories 
SET 
  google_category_id = '2151',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment'
WHERE slug IN ('cnc-plasma', 'plasma', 'tornos', 'centros-maquinado', 'dobladora-acrilico', 'dobladora');

-- Refacciones / Repuestos (General)
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('refacciones', 'repuestos', 'partes');

-- Tubos Láser (EFR, PURI, RECI)
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('tubos-laser', 'tubo-laser', 'tubos', 'tubo-co2', 'tubo-rf');

-- Espejos y Lentes
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('espejos', 'lentes', 'optica', 'lente-laser', 'espejo-laser');

-- Fuentes de poder y Drivers
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('fuentes-poder', 'fuente-poder', 'drivers', 'driver', 'controladores');

-- Chillers y Compresores/Extractores
UPDATE categories 
SET 
  google_category_id = '2151',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment'
WHERE slug IN ('chillers', 'chiller', 'compresores', 'compresor', 'extractores', 'extractor', 'chillers-compresores-extractores');

-- Bombas de Agua
UPDATE categories 
SET 
  google_category_id = '2453',
  google_category_name = 'Hardware > Pumps'
WHERE slug IN ('bombas', 'bomba', 'bomba-agua');

-- Acrílico y PET-G
UPDATE categories 
SET 
  google_category_id = '505370',
  google_category_name = 'Business & Industrial > Plastics & Rubber'
WHERE slug IN ('acrilico', 'petg', 'pet-g', 'plasticos', 'materiales');

-- Joyería (Acero, Oro, Plata)
UPDATE categories 
SET 
  google_category_id = '188',
  google_category_name = 'Apparel & Accessories > Jewelry'
WHERE slug IN ('joyeria', 'joyas', 'accesorios');

-- Bandas
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('bandas', 'banda', 'refacciones-y-consumibles-bandas');

-- Interruptores
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('interruptores', 'interruptor', 'switches', 'refacciones-y-consumibles-interruptores');

-- Cabezales
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('cabezales', 'cabezal', 'heads', 'refacciones-y-consumibles-cabezales');

-- Cables
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('cables', 'cable', 'refacciones-y-consumibles-cables');

-- Cadenas (Portacables)
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('cadenas', 'cadena', 'portacables', 'porta-cables', 'refacciones-y-consumibles-cadenas');

-- Conectores
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('conectores', 'conector', 'connectors', 'refacciones-y-consumibles-conectores');

-- Rotativos
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('rotativos', 'rotativo', 'rotary', 'refacciones-y-consumibles-rotativos');

-- Pistones
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('pistones', 'piston', 'refacciones-y-consumibles-pistones');

-- Flybacks
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('flybacks', 'flyback', 'refacciones-y-consumibles-flybacks');

-- Refacciones (categoria padre general)
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('refacciones-y-consumibles');

-- Espejos / Lentes (actualizar con slug correcto)
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('espejos', 'lentes', 'optica', 'lente-laser', 'espejo-laser', 'refacciones-y-consumibles-espejos-lentes');

-- Fuentes de poder (actualizar con slug correcto)
UPDATE categories 
SET 
  google_category_id = '5396',
  google_category_name = 'Business & Industrial > Manufacturing > Manufacturing Machinery & Equipment > Manufacturing Machinery & Equipment Parts & Accessories'
WHERE slug IN ('fuentes-poder', 'fuente-poder', 'drivers', 'driver', 'controladores', 'refacciones-y-consumibles-fuentes-de-poder', 'refacciones-y-consumibles-contoladores-drivers');

-- Bombas de Agua (actualizar con slug correcto)
UPDATE categories 
SET 
  google_category_id = '2453',
  google_category_name = 'Hardware > Pumps'
WHERE slug IN ('bombas', 'bomba', 'bomba-agua', 'chillers-compresores-extractores-bomba-de-agua');

-- =====================================================
-- Verificación
-- =====================================================

-- Ver categorías mapeadas
-- SELECT id, name, slug, google_category_id, google_category_name, parent_id 
-- FROM categories 
-- WHERE google_category_id IS NOT NULL
-- ORDER BY name;

-- Ver categorías sin mapeo
-- SELECT id, name, slug, parent_id
-- FROM categories 
-- WHERE google_category_id IS NULL
-- ORDER BY name;
