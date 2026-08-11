# Guía: Acrílico por lámina (color / grosor / cortes calculados)

## Objetivo
Das de alta solo **láminas completas 122×244** (color + grosor + precio + stock).  
Los tamaños de venta y el corte personalizado se calculan con factores globales.

## Detección
Especificación del producto:

- `tipo_producto` = `acrilico`

## Alta en Admin → Productos → Variantes
Cada fila es una **lámina**:

| Campo | Uso |
|-------|-----|
| Color / HEX / foto | Identificación visual |
| Grosor | Ej. 3mm |
| Precio lámina | Precio 122×244 |
| Stock láminas | Conteos manuales (no se descuentan al vender cortes) |

Attributes guardados:

```json
{
  "color": "Plata",
  "color_hex": "#C0C0C0",
  "grosor": "3mm",
  "image_url": "...",
  "is_sheet": true,
  "sheet_width_cm": 122,
  "sheet_height_cm": 244
}
```

Botón **Consolidar a láminas**: agrupa variantes viejas (cortes) por color+grosor.

## Configuración → Acrílico
Factores globales:

- Tamaños fijos (122×122, 120×90, …) con factor
- Corte personalizado: reglas área → factor

Fórmulas:

- Fijo: `ROUND(precio_lámina × (ancho×alto / 29768) × factor)`
- Personalizado: `ROUND(area × (precio_lámina / 29768) × factor_umbral)`

## Tienda
1. Color → Grosor (lámina)
2. Tamaño fijo o **Medida especial** (ancho × alto)
3. Precio calculado → carrito con `acrylicCut`

## Inventario
El stock de lámina **no** baja automáticamente al vender un corte. Ajusta a mano tras surtir.

## Archivos
- Cálculo: `src/lib/acrylicPricing.ts`
- Config admin: `src/routes/admin/configuracion/acrylic/+page.svelte`
- PDP: `src/routes/productos/[slug]/+page.svelte`
- Productos admin: `src/routes/admin/productos/+page.svelte`
