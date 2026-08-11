# Guía: Variantes de acrílico (color/grosor/tamaño)

## Objetivo
Cada acabado es un producto distinto (ej. “Lámina de Acrílico Transparente”, “Mate”, “Tornasol”).
Dentro de ese producto, las variantes se seleccionan por **color**, **grosor** y **tamaño**. El selector muestra solo opciones disponibles.

## Detección de producto acrílico
Debes agregar una especificación al producto en `product_specifications`:

- `specification_key`: `tipo_producto`
- `specification_value`: `acrilico`

Si este valor existe, la página de detalle activa el selector especial de acrílico.

### Cómo hacerlo en la UI (Admin)
1. Entra a Admin → Productos.
2. Edita el producto de acrílico (ej. “Lámina de Acrílico Transparente”).
3. En la pestaña “Especificaciones”, agrega:
  - Clave: `tipo_producto`
  - Valor: `acrilico`

## Estructura de variantes (obligatorio)
En cada variante de `product_variants`, usa el campo `attributes` con estas claves:

- `color`: nombre del color (ej. `verde`, `rosa`, `azul`)
- `color_hex`: código HEX (ej. `#22c55e`) **opcional pero recomendado**
- `grosor`: grosor (ej. `3mm`, `5mm` o `3`)
- `tamano`: tamaño (ej. `60x90 cm` o `120x240 cm`)
- `image_url`: URL de la foto del color (**opcional**; misma URL en todas las variantes de ese color)

Ejemplo de `attributes`:

```json
{
  "color": "verde",
  "color_hex": "#22c55e",
  "grosor": "3mm",
  "tamano": "60x90 cm",
  "image_url": "https://.../products/...-color-verde-....jpg"
}
```

## Foto por color
- La foto es **por color**, no por cada combinación grosor/tamaño.
- En Admin → Productos → pestaña Variantes (producto acrílico), usa el bloque **Fotos por color** para subir o quitar la imagen de cada color.
- Al guardar el producto, `image_url` se escribe en todas las variantes de ese color.
- En la tienda, al seleccionar un color se muestra esa foto como imagen principal. Si el color no tiene foto, se usa la imagen principal del producto (`product_media`).
- Al **Duplicar color**, se copia también la `image_url` del color origen (puedes cambiarla después en Fotos por color).

## Orden y disponibilidad
- El orden es **ascendente** (numérico si detecta números en el texto).
- Solo se muestran opciones que **existen en variantes activas** y con stock.

## Flujo esperado
1. Entra al producto “Lámina de Acrílico X”.
2. Selecciona color (muestra solo colores disponibles; la imagen principal cambia si hay foto del color).
3. Selecciona grosor (filtrado por color).
4. Selecciona tamaño (filtrado por color + grosor).
5. Se elige automáticamente la variante que coincide con la combinación.

## Reglas importantes
- Si el producto no tiene `tipo_producto=acrilico`, la UI usa el selector clásico de variantes.
- El campo `color_hex` se usa para pintar el selector; si no existe, se intenta mapear el nombre a un color básico.
- Las claves deben ir **sin acentos**: `tamano`, no `tamaño`.

## Checklist rápido (para un nuevo producto acrílico)
1. Crear producto: “Lámina de Acrílico [Acabado]”.
2. Agregar especificación: `tipo_producto = acrilico` (pestaña Especificaciones).
3. Crear variantes con `attributes` completos (pestaña Variantes).
4. (Opcional) Asignar fotos por color en **Fotos por color**.
5. Verificar que el stock y `is_active` estén correctos.

## Cómo cargar color/grosor/tamaño desde la UI
1. En la pestaña “Variantes”, agrega o edita una variante.
2. Llena los campos:
  - Color (ej. verde)
  - Color HEX (ej. #22c55e)
  - Grosor (ej. 3mm)
  - Tamaño (ej. 60x90 cm)
3. En **Fotos por color**, sube la imagen de cada color.
4. Guarda el producto.

## Archivos relevantes
- Lógica de detección: [src/routes/productos/[slug]/+page.svelte](src/routes/productos/[slug]/+page.svelte)
- Carga de especificaciones: [src/routes/productos/[slug]/+page.ts](src/routes/productos/[slug]/+page.ts)
- Admin variantes / fotos por color: [src/routes/admin/productos/+page.svelte](src/routes/admin/productos/+page.svelte)
- Tipos: [src/lib/types/database.types.ts](src/lib/types/database.types.ts)
