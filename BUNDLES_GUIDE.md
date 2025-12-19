# Guía de Paquetes/Bundles de Productos

## Descripción General

El sistema de bundles permite crear paquetes de productos que se muestran como opciones en la página de producto, de manera similar a las variantes. Los bundles permiten agrupar varios productos/variantes con un precio especial y mostrar el ahorro que representa para el cliente.

## Estructura de Base de Datos

### Tabla `product_bundles`

Almacena la información principal de cada paquete.

**Campos:**
- `id`: UUID único del bundle
- `product_id`: ID del producto al que pertenece el bundle
- `name`: Nombre del paquete (ej: "Kit Completo", "Paquete Familiar")
- `description`: Descripción opcional del paquete
- `sku`: SKU único del bundle (opcional)
- `bundle_price`: Precio total del paquete
- `discount_percentage`: Porcentaje de descuento calculado
- `stock_quantity`: Cantidad disponible en stock
- `is_active`: Si el bundle está activo y visible
- `display_order`: Orden de visualización
- `created_at`, `updated_at`: Timestamps

### Tabla `bundle_items`

Define los productos que componen cada bundle.

**Campos:**
- `id`: UUID único del item
- `bundle_id`: ID del bundle al que pertenece
- `product_id`: ID del producto incluido
- `variant_id`: ID de la variante específica (opcional)
- `quantity`: Cantidad de este producto en el bundle
- `display_order`: Orden de visualización
- `created_at`: Timestamp

## Instalación

### 1. Ejecutar la Migración

Ejecuta el archivo de migración en Supabase:

```bash
# Desde Supabase SQL Editor
-- Ejecuta: database/migrations/create_product_bundles.sql
```

O desde la CLI de Supabase:

```bash
supabase db push
```

### 2. Verificar Políticas RLS

Las políticas ya están configuradas en la migración:
- Lectura pública de bundles activos
- Administradores pueden hacer todo

## Crear un Bundle

### Ejemplo SQL

```sql
-- 1. Crear el bundle
INSERT INTO product_bundles (
    product_id,
    name,
    description,
    bundle_price,
    stock_quantity
) VALUES (
    'id-del-producto-principal',
    'Kit Completo',
    'Incluye pistola, cargador extra y objetivo',
    1499.00,
    10
);

-- 2. Agregar items al bundle
INSERT INTO bundle_items (bundle_id, product_id, quantity) VALUES
    ('id-del-bundle', 'id-producto-1', 1),
    ('id-del-bundle', 'id-producto-2', 2),
    ('id-del-bundle', 'id-producto-3', 1);

-- Para incluir una variante específica:
INSERT INTO bundle_items (bundle_id, product_id, variant_id, quantity) VALUES
    ('id-del-bundle', 'id-producto', 'id-variante', 1);
```

### Desde la Aplicación (Ejemplo)

```typescript
import { supabase } from '$lib/supabaseClient';

// Crear bundle
const { data: bundle } = await supabase
    .from('product_bundles')
    .insert({
        product_id: productId,
        name: 'Kit Completo',
        description: 'Todo lo que necesitas',
        bundle_price: 1499.00,
        stock_quantity: 10
    })
    .select()
    .single();

// Agregar items
const items = [
    { bundle_id: bundle.id, product_id: 'prod1', quantity: 1 },
    { bundle_id: bundle.id, product_id: 'prod2', quantity: 2 }
];

await supabase.from('bundle_items').insert(items);
```

## Características Implementadas

### 1. Vista de Producto

Los bundles se muestran en la página de producto después de las variantes:
- Tarjetas expandidas con toda la información
- Lista de productos incluidos
- Precio del bundle vs valor total (ahorro)
- Porcentaje de descuento
- Stock disponible
- Selección exclusiva (no puedes seleccionar variante y bundle al mismo tiempo)

### 2. Carrito de Compras

El carrito identifica y muestra bundles:
- Icono 📦 para identificar paquetes
- Lista de items incluidos
- Muestra el ahorro
- Gestión de cantidad independiente

### 3. Cálculos Automáticos

El sistema calcula automáticamente:
- **Valor Total**: Suma de precios individuales de todos los items
- **Ahorro**: Diferencia entre valor total y precio del bundle
- **Porcentaje de Descuento**: `(ahorro / valor_total) * 100`

### 4. Stock

Cada bundle tiene su propio stock independiente del stock de los productos individuales.

## Ejemplo de Uso

### Caso 1: Bundle Simple

**Producto Principal**: Pistola Láser X1
**Bundle "Kit Básico"**:
- 1x Pistola Láser X1 ($500)
- 1x Cargador Extra ($100)
- Precio Bundle: $540 (ahorro $60 = 10% OFF)

### Caso 2: Bundle con Variantes

**Producto Principal**: Rifle Láser Pro
**Bundle "Kit Profesional"**:
- 1x Rifle Láser Pro - Variante "Rojo" ($1000)
- 2x Batería de Litio ($150 c/u)
- 1x Estuche Protector ($200)
- Precio Bundle: $1350 (ahorro $150 = 11% OFF)

## Ventajas del Sistema

1. **Flexibilidad**: Puedes crear múltiples bundles por producto
2. **Visual Atractivo**: Similar a variantes pero con más información
3. **Ahorro Visible**: El cliente ve claramente cuánto ahorra
4. **Gestión Independiente**: Stock y precio propios
5. **Combinaciones**: Puedes incluir variantes específicas
6. **Escalable**: Fácil agregar más items a un bundle

## Próximos Pasos Sugeridos

1. **Panel de Administración**: Crear interfaz para gestionar bundles
2. **Validación de Stock**: Verificar stock de items individuales
3. **Imágenes de Bundle**: Agregar imágenes específicas para bundles
4. **Analytics**: Rastrear popularidad de bundles
5. **Descuentos Automáticos**: Calcular precio del bundle basado en porcentaje

## API de Consulta

### Obtener Bundles de un Producto

```typescript
const { data: bundles } = await supabase
    .from('product_bundles')
    .select(`
        *,
        bundle_items (
            *,
            products (*),
            product_variants (*)
        )
    `)
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('display_order');
```

### Filtrar por Stock Disponible

```typescript
const { data: bundles } = await supabase
    .from('product_bundles')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .gt('stock_quantity', 0);
```

## Notas Importantes

- Los bundles se muestran como alternativas a las variantes, no como un complemento
- Al seleccionar un bundle, se deselecciona la variante y viceversa
- El precio final es el del bundle, sin aplicar descuentos adicionales del producto
- Cada bundle tiene su propio control de stock
- Los bundles se almacenan en el carrito con toda su información para evitar recalcular

## Troubleshooting

### Los bundles no aparecen en la página

1. Verifica que `is_active = true`
2. Verifica que haya stock (`stock_quantity > 0`)
3. Verifica que el `product_id` sea correcto
4. Revisa las políticas RLS en Supabase

### El ahorro no se calcula correctamente

El cálculo se hace en el frontend (`+page.ts`). Verifica que:
- Los items tengan precios correctos
- Las variantes estén bien referenciadas
- La suma del `bundle_price` sea menor que el total

### Error al agregar al carrito

Verifica que el tipo `CartItem` incluya el campo `bundle` opcional.
