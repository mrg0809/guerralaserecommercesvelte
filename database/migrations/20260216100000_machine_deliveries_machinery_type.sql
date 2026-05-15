-- Tipo de maquinaria en entregas (orden alfabético por etiqueta en UI)

ALTER TABLE machine_deliveries
ADD COLUMN IF NOT EXISTS machinery_type VARCHAR(50);

UPDATE machine_deliveries
SET machinery_type = 'co2'
WHERE machinery_type IS NULL;

ALTER TABLE machine_deliveries
ALTER COLUMN machinery_type SET NOT NULL;

ALTER TABLE machine_deliveries DROP CONSTRAINT IF EXISTS machine_deliveries_machinery_type_check;

ALTER TABLE machine_deliveries
ADD CONSTRAINT machine_deliveries_machinery_type_check
CHECK (
	machinery_type IN (
		'canteadora',
		'centro_maquinado',
		'cnc',
		'co2',
		'fibra_optica',
		'plasma',
		'torno'
	)
);
