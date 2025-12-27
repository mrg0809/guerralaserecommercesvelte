-- =====================================================
-- Sample Category Mappings for PIM System
-- =====================================================
-- This file contains example category templates for common product types
-- Run these after creating the main PIM tables

-- =====================================================
-- Amazon Category Templates
-- =====================================================

-- Sensors (Industrial Automation)
INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'sensor',
	'amazon',
	'ce_automation_industrial_supplies',
	'Sensores Industriales',
	'{
		"fields": [
			{"name": "power_watts", "type": "number", "required": true, "label": "Potencia (Watts)"},
			{"name": "voltage", "type": "number", "required": true, "label": "Voltaje"},
			{"name": "operating_temperature", "type": "text", "required": false, "label": "Temperatura de Operación"},
			{"name": "material", "type": "select", "required": false, "label": "Material", "options": ["Acero inoxidable", "Aluminio", "Plástico", "Otro"]},
			{"name": "color", "type": "select", "required": false, "label": "Color", "options": ["Negro", "Plateado", "Blanco", "Otro"]}
		]
	}'::jsonb
);

-- Laser Equipment
INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'laser',
	'amazon',
	'home_improvement',
	'Equipos Láser',
	'{
		"fields": [
			{"name": "laser_power", "type": "number", "required": true, "label": "Potencia del Láser (W)"},
			{"name": "laser_type", "type": "select", "required": true, "label": "Tipo de Láser", "options": ["CO2", "Fibra", "Diodo", "Otro"]},
			{"name": "work_area_length", "type": "number", "required": false, "label": "Área de Trabajo - Largo (mm)"},
			{"name": "work_area_width", "type": "number", "required": false, "label": "Área de Trabajo - Ancho (mm)"},
			{"name": "voltage", "type": "number", "required": true, "label": "Voltaje"},
			{"name": "warranty_months", "type": "number", "required": false, "label": "Garantía (meses)"}
		]
	}'::jsonb
);

-- Motors
INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'motor',
	'amazon',
	'industrial_electric_motors',
	'Motores Eléctricos',
	'{
		"fields": [
			{"name": "motor_power_hp", "type": "number", "required": true, "label": "Potencia (HP)"},
			{"name": "voltage", "type": "number", "required": true, "label": "Voltaje"},
			{"name": "rpm", "type": "number", "required": true, "label": "RPM"},
			{"name": "motor_type", "type": "select", "required": true, "label": "Tipo de Motor", "options": ["AC", "DC", "Paso a paso", "Servo"]},
			{"name": "shaft_diameter", "type": "number", "required": false, "label": "Diámetro del Eje (mm)"}
		]
	}'::jsonb
);

-- Accessories
INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'accesorio',
	'amazon',
	'industrial_accessories',
	'Accesorios Industriales',
	'{
		"fields": [
			{"name": "material", "type": "text", "required": false, "label": "Material"},
			{"name": "dimensions", "type": "text", "required": false, "label": "Dimensiones"},
			{"name": "weight_kg", "type": "number", "required": false, "label": "Peso (kg)"},
			{"name": "color", "type": "text", "required": false, "label": "Color"}
		]
	}'::jsonb
);

-- =====================================================
-- Mercado Libre Category Templates
-- =====================================================

-- Sensors
INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'sensor',
	'mercadolibre',
	'MLA1532',
	'Herramientas - Sensores',
	'{
		"fields": [
			{"name": "BRAND", "type": "text", "required": true, "label": "Marca"},
			{"name": "MODEL", "type": "text", "required": true, "label": "Modelo"},
			{"name": "WARRANTY_TYPE", "type": "select", "required": true, "label": "Tipo de Garantía", "options": ["Garantía del vendedor", "Garantía de fábrica", "Sin garantía"]},
			{"name": "WARRANTY_TIME", "type": "text", "required": false, "label": "Tiempo de Garantía"},
			{"name": "VOLTAGE", "type": "text", "required": false, "label": "Voltaje"},
			{"name": "POWER", "type": "text", "required": false, "label": "Potencia"}
		]
	}'::jsonb
);

-- Laser Equipment
INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'laser',
	'mercadolibre',
	'MLA409821',
	'Industrias y Oficinas - Equipos Láser',
	'{
		"fields": [
			{"name": "BRAND", "type": "text", "required": true, "label": "Marca"},
			{"name": "MODEL", "type": "text", "required": true, "label": "Modelo"},
			{"name": "WARRANTY_TYPE", "type": "select", "required": true, "label": "Tipo de Garantía", "options": ["Garantía del vendedor", "Garantía de fábrica", "Sin garantía"]},
			{"name": "WARRANTY_TIME", "type": "text", "required": false, "label": "Tiempo de Garantía"},
			{"name": "LASER_POWER", "type": "text", "required": true, "label": "Potencia del Láser"},
			{"name": "LASER_TYPE", "type": "select", "required": false, "label": "Tipo de Láser", "options": ["CO2", "Fibra", "Diodo"]},
			{"name": "WORK_AREA", "type": "text", "required": false, "label": "Área de Trabajo"}
		]
	}'::jsonb
);

-- Motors
INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'motor',
	'mercadolibre',
	'MLA5726',
	'Herramientas - Motores',
	'{
		"fields": [
			{"name": "BRAND", "type": "text", "required": true, "label": "Marca"},
			{"name": "MODEL", "type": "text", "required": true, "label": "Modelo"},
			{"name": "MOTOR_POWER", "type": "text", "required": true, "label": "Potencia"},
			{"name": "VOLTAGE", "type": "text", "required": true, "label": "Voltaje"},
			{"name": "RPM", "type": "text", "required": false, "label": "RPM"},
			{"name": "WARRANTY_TYPE", "type": "select", "required": true, "label": "Tipo de Garantía", "options": ["Garantía del vendedor", "Garantía de fábrica", "Sin garantía"]}
		]
	}'::jsonb
);

-- Accessories
INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'accesorio',
	'mercadolibre',
	'MLA1540',
	'Herramientas - Accesorios',
	'{
		"fields": [
			{"name": "BRAND", "type": "text", "required": true, "label": "Marca"},
			{"name": "MODEL", "type": "text", "required": false, "label": "Modelo"},
			{"name": "MATERIAL", "type": "text", "required": false, "label": "Material"},
			{"name": "WARRANTY_TYPE", "type": "select", "required": false, "label": "Tipo de Garantía", "options": ["Garantía del vendedor", "Sin garantía"]}
		]
	}'::jsonb
);

-- =====================================================
-- SAT Category Templates (Optional - for reference)
-- =====================================================
-- SAT doesn't have dynamic schemas like Amazon/ML, but we can still map types

INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'sensor',
	'sat',
	'43211500',
	'Equipos de medición y observación',
	'{}'::jsonb
);

INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'laser',
	'sat',
	'43211700',
	'Equipos láser',
	'{}'::jsonb
);

INSERT INTO public.category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
	'motor',
	'sat',
	'26101600',
	'Motores eléctricos',
	'{}'::jsonb
);

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this to verify all templates were created successfully:

SELECT 
	internal_type,
	platform,
	external_category_name,
	jsonb_array_length(required_schema->'fields') as field_count
FROM public.category_mappings
ORDER BY platform, internal_type;

-- =====================================================
-- Notes
-- =====================================================
-- 1. Adjust external_category_id values based on actual platform categories
-- 2. Add more fields to required_schema as needed
-- 3. Update options arrays for select fields based on your requirements
-- 4. These are templates - customize for your specific products
