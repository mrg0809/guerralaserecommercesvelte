# Instrucciones de Configuración del Sistema PIM

## Descripción General

Este documento proporciona instrucciones detalladas para configurar el sistema PIM (Product Information Management) en Supabase. El sistema permite gestionar productos para múltiples canales de venta: Amazon, Mercado Libre y SAT (Sistema de Administración Tributaria de México).

## Tablas Creadas

El sistema PIM incluye 4 tablas nuevas:

1. **`sat_product_info`**: Información fiscal SAT para productos
2. **`amazon_listings`**: Datos específicos para listados en Amazon
3. **`mercadolibre_listings`**: Datos específicos para listados en Mercado Libre
4. **`category_mappings`**: Sistema de plantillas para mapeo de categorías

## Pasos para Crear las Tablas en Supabase

### Opción 1: Usando el Editor SQL de Supabase (Recomendado)

1. **Acceder a Supabase Dashboard**
   - Ir a [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Seleccionar tu proyecto

2. **Abrir el Editor SQL**
   - En el menú lateral, hacer clic en "SQL Editor"
   - Hacer clic en "New Query" (Nueva Consulta)

3. **Ejecutar el Script de Migración**
   - Copiar todo el contenido del archivo: `database/migrations/create_pim_tables.sql`
   - Pegarlo en el editor SQL
   - Hacer clic en "Run" (Ejecutar) o presionar `Ctrl+Enter`

4. **Verificar la Creación**
   - Ir a "Table Editor" en el menú lateral
   - Verificar que las 4 nuevas tablas aparezcan:
     - `sat_product_info`
     - `amazon_listings`
     - `mercadolibre_listings`
     - `category_mappings`

### Opción 2: Usando Supabase CLI

Si prefieres usar la línea de comandos:

```bash
# 1. Instalar Supabase CLI (si no está instalado)
npm install -g supabase

# 2. Iniciar sesión en Supabase
supabase login

# 3. Vincular tu proyecto local con Supabase
supabase link --project-ref YOUR_PROJECT_REF

# 4. Ejecutar la migración
supabase db push
```

## Estructura de las Tablas

### 1. `sat_product_info` (Información SAT)

Almacena información fiscal requerida por el SAT de México:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID único de la tabla |
| `product_id` | uuid | Referencia al producto (FK a `products.id`) |
| `clave_prod_serv` | text | Clave de producto/servicio SAT (8 dígitos) |
| `clave_unidad` | text | Clave de unidad SAT |
| `unidad_medida` | text | Descripción de la unidad de medida |
| `material_peligroso` | boolean | Indica si es material peligroso |
| `created_at` | timestamp | Fecha de creación |
| `updated_at` | timestamp | Fecha de última actualización |

**Ejemplo de uso:**
```sql
INSERT INTO sat_product_info (product_id, clave_prod_serv, clave_unidad, unidad_medida, material_peligroso)
VALUES (
  'abc123-...',
  '43211500',
  'H87',
  'Pieza',
  false
);
```

### 2. `amazon_listings` (Listados de Amazon)

Almacena información específica para productos en Amazon:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID único de la tabla |
| `product_id` | uuid | Referencia al producto (FK a `products.id`) |
| `sku_amazon` | text | SKU específico de Amazon |
| `asin` | text | Amazon Standard Identification Number |
| `feed_product_type` | text | Tipo de feed de producto (ej: "Home") |
| `bullet_points` | jsonb | Array de viñetas del producto |
| `specific_attributes` | jsonb | Atributos dinámicos específicos |
| `created_at` | timestamp | Fecha de creación |
| `updated_at` | timestamp | Fecha de última actualización |

**Ejemplo de uso:**
```sql
INSERT INTO amazon_listings (product_id, sku_amazon, asin, feed_product_type, bullet_points, specific_attributes)
VALUES (
  'abc123-...',
  'GLT-SEN-001',
  'B08XYZ1234',
  'Home',
  '["Alta precisión de detección", "Resistente al agua", "Fácil instalación"]'::jsonb,
  '{"power_watts": "100", "voltage": "220", "material": "Acero inoxidable"}'::jsonb
);
```

### 3. `mercadolibre_listings` (Listados de Mercado Libre)

Almacena información específica para productos en Mercado Libre:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID único de la tabla |
| `product_id` | uuid | Referencia al producto (FK a `products.id`) |
| `ml_id` | text | ID del listado en Mercado Libre |
| `listing_type` | text | Tipo de publicación (ej: "gold_special") |
| `attributes` | jsonb | Atributos dinámicos del producto |
| `created_at` | timestamp | Fecha de creación |
| `updated_at` | timestamp | Fecha de última actualización |

**Ejemplo de uso:**
```sql
INSERT INTO mercadolibre_listings (product_id, ml_id, listing_type, attributes)
VALUES (
  'abc123-...',
  'MLM123456789',
  'gold_special',
  '{"BRAND": "Guerra Laser", "MODEL": "GL-2024", "WARRANTY_TYPE": "Garantía del vendedor"}'::jsonb
);
```

### 4. `category_mappings` (Mapeo de Categorías)

Sistema de plantillas para mapear tipos internos a categorías externas:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID único de la tabla |
| `internal_type` | text | Tipo interno del producto (ej: "sensor") |
| `platform` | text | Plataforma (amazon, mercadolibre, sat) |
| `external_category_id` | text | ID de categoría externa |
| `external_category_name` | text | Nombre de categoría externa |
| `required_schema` | jsonb | Schema JSON con campos requeridos |
| `created_at` | timestamp | Fecha de creación |
| `updated_at` | timestamp | Fecha de última actualización |

**Ejemplo de uso:**
```sql
INSERT INTO category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
  'sensor',
  'amazon',
  'ce_automation_industrial_supplies',
  'Sensores Industriales',
  '{
    "fields": [
      {"name": "power_watts", "type": "number", "required": true, "label": "Potencia (Watts)"},
      {"name": "voltage", "type": "number", "required": true, "label": "Voltaje"},
      {"name": "material", "type": "text", "required": false, "label": "Material"}
    ]
  }'::jsonb
);
```

## Configuración de Políticas de Seguridad (RLS)

Las tablas incluyen políticas de Row Level Security (RLS) configuradas de la siguiente manera:

- **Lectura (SELECT)**: Acceso público para todos los usuarios
- **Escritura (INSERT/UPDATE/DELETE)**: Solo usuarios autenticados

Esto permite que:
- Los usuarios no autenticados puedan ver los productos y sus datos
- Solo administradores autenticados puedan modificar la información

## Próximos Pasos

### 1. Crear Plantillas de Categorías Iniciales

Es recomendable crear algunas plantillas de categorías iniciales. Ejemplo:

```sql
-- Plantilla para sensores en Amazon
INSERT INTO category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
  'sensor',
  'amazon',
  'ce_automation_industrial_supplies',
  'Sensores Industriales',
  '{
    "fields": [
      {"name": "power_watts", "type": "number", "required": true, "label": "Potencia (Watts)"},
      {"name": "voltage", "type": "number", "required": true, "label": "Voltaje"},
      {"name": "operating_temperature", "type": "text", "required": false, "label": "Temperatura de Operación"}
    ]
  }'::jsonb
);

-- Plantilla para láser en Mercado Libre
INSERT INTO category_mappings (internal_type, platform, external_category_id, external_category_name, required_schema)
VALUES (
  'laser',
  'mercadolibre',
  'MLA1532',
  'Herramientas Industriales',
  '{
    "fields": [
      {"name": "BRAND", "type": "text", "required": true, "label": "Marca"},
      {"name": "MODEL", "type": "text", "required": true, "label": "Modelo"},
      {"name": "WARRANTY_TYPE", "type": "select", "required": true, "label": "Tipo de Garantía", "options": ["Garantía del vendedor", "Sin garantía"]}
    ]
  }'::jsonb
);
```

### 2. Actualizar Tipos TypeScript

Después de crear las tablas en Supabase:

1. Regenerar los tipos TypeScript desde Supabase:
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/lib/types/database.types.ts
   ```

2. O actualizar manualmente el archivo `src/lib/types/database.types.ts` con las nuevas tablas.

### 3. Probar la Integración

En la interfaz de usuario de administración:

1. Ir a la página de edición de productos
2. Verás nuevas pestañas: "SAT", "Amazon", "Mercado Libre"
3. Completar la información específica de cada plataforma
4. Guardar y verificar que los datos se almacenan correctamente

### 4. Exportar Datos a CSV/Excel

Usa las funciones de exportación para:
- Generar archivos CSV compatibles con Amazon Inventory Loader
- Generar archivos para importación masiva en Mercado Libre

## Solución de Problemas

### Error: "relation already exists"

Si recibes este error, significa que las tablas ya existen. Puedes:

1. Eliminar las tablas existentes (¡CUIDADO! esto eliminará todos los datos):
   ```sql
   DROP TABLE IF EXISTS category_mappings CASCADE;
   DROP TABLE IF EXISTS mercadolibre_listings CASCADE;
   DROP TABLE IF EXISTS amazon_listings CASCADE;
   DROP TABLE IF EXISTS sat_product_info CASCADE;
   ```

2. Luego ejecutar nuevamente el script de creación.

### Error: "permission denied"

Asegúrate de estar conectado como usuario con permisos de administrador en Supabase.

### Campos JSONB no se muestran correctamente

Los campos JSONB deben ingresarse como JSON válido. Ejemplo correcto:
```json
{
  "power_watts": "100",
  "voltage": "220"
}
```

## Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Guía de Amazon Inventory Loader](https://sellercentral.amazon.com/gp/help/201576410)
- [API de Mercado Libre](https://developers.mercadolibre.com.mx/)
- [Catálogos SAT](http://omawww.sat.gob.mx/tramitesyservicios/Paginas/catalogos_emision_cfdi_2022.htm)

## Soporte

Para preguntas o problemas con la implementación:

1. Revisar la documentación en el repositorio
2. Verificar los logs en Supabase Dashboard > Logs
3. Contactar al equipo de desarrollo

---

**Última actualización:** Diciembre 2024  
**Versión del sistema:** 1.0.0
