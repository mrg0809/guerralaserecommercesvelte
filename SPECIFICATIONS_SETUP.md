# Instalación de Especificaciones de Productos

## Paso 1: Ejecutar el SQL en Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto "guerralaserecommercesvelte"
3. Ve a la sección **SQL Editor** en el lado izquierdo
4. Copia y pega el contenido del archivo `database/migrations/create_product_specifications.sql`
5. Haz click en **Run** para ejecutar el script

## Paso 2: Estructura de la Tabla

La tabla `product_specifications` tiene los siguientes campos:

- **id** (uuid): Identificador único
- **product_id** (uuid): Referencia al producto
- **specification_key** (text): Nombre del atributo (ej: "Potencia", "Velocidad", "Tamaño de Cama")
- **specification_value** (text): Valor del atributo (ej: "40W", "100mm/s", "600x400mm")
- **data_type** (text): Tipo de dato - puede ser:
  - `text`: Texto libre
  - `number`: Número
  - `boolean`: Verdadero/Falso
  - `select`: Valor de un listado
- **created_at** / **updated_at**: Timestamps

## Ejemplo de Uso

Para un producto "Máquina Láser CO2 40W" podrías agregar:

```
specification_key: "Potencia"
specification_value: "40W"
data_type: "text"

specification_key: "Velocidad de Corte"
specification_value: "100"
data_type: "number"

specification_key: "Tamaño de Cama"
specification_value: "600x400"
data_type: "text"
```

## Búsquedas Posibles

Con esta estructura puedes realizar búsquedas como:

```typescript
// Buscar todos los productos con potencia de 40W
const { data } = await supabase
  .from('product_specifications')
  .select('product_id')
  .eq('specification_key', 'Potencia')
  .eq('specification_value', '40W');

// Buscar productos con velocidad > 100
const { data } = await supabase
  .from('product_specifications')
  .select('product_id')
  .eq('specification_key', 'Velocidad de Corte')
  .gt('specification_value::numeric', 100);
```

## Próximos Pasos

1. Crear panel de administración para gestionar especificaciones por producto
2. Implementar filtros avanzados de búsqueda basados en especificaciones
3. Crear página de comparativa de productos por especificaciones
