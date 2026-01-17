# Sistema de Cotizaciones - Guerra Laser México

## 📋 Descripción

Sistema completo para crear, gestionar y generar cotizaciones profesionales en PDF para clientes.

## 🗄️ Configuración de Base de Datos

### Paso 1: Crear las tablas

Ejecuta el siguiente SQL en tu proyecto de Supabase (SQL Editor):

```sql
-- Ejecutar el archivo: database/migrations/create_quotations.sql
```

O copia y pega el contenido de `database/migrations/create_quotations.sql` en el SQL Editor de Supabase.

Este script creará:
- **Tabla `quotations`**: Almacena la información principal de cada cotización
- **Tabla `quotation_items`**: Almacena los productos/items de cada cotización
- **Función `generate_quotation_number()`**: Genera números de cotización automáticos (formato: YYYY-000001)
- **Políticas RLS**: Permisos para usuarios autenticados
- **Índices**: Para mejorar el rendimiento de las consultas

### Paso 2: Verificar la instalación

Puedes verificar que las tablas se crearon correctamente ejecutando:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('quotations', 'quotation_items');
```

## 🚀 Características

### 1. Crear Cotizaciones
- **Acceso**: Dashboard Admin → "Crear Cotización" 🧾
- **Datos del cliente**: Nombre, empresa, RFC, correo, teléfono, dirección
- **Condiciones comerciales**: Vigencia, forma de pago, notas
- **Búsqueda de productos**: Por nombre o SKU
- **Visualización de stock**: Con indicadores de color
  - 🟢 Verde: >10 unidades
  - 🟡 Amarillo: 1-10 unidades
  - 🔴 Rojo: Sin stock

### 2. Edición de Items
Cada producto agregado permite editar:
- **Descripción**: Personalizable para la cotización
- **Cantidad**: Unidades a cotizar
- **Precio unitario**: Precio por unidad (editable)
- **Descuento por línea**: Porcentaje de descuento específico del item

### 3. Cálculos Automáticos
- **Subtotal por línea**: Cantidad × Precio - Descuento de línea
- **Subtotal general**: Suma de todos los items
- **Descuento general**: Porcentaje aplicado sobre el subtotal
- **Total**: Subtotal - Descuento general

### 4. Guardar en Base de Datos
- **Botón**: 💾 Guardar Cotización
- **Genera**: Número único de cotización (formato: 2026-000001)
- **Almacena**:
  - Datos del cliente
  - Items con cantidades, precios y descuentos
  - Totales calculados
  - Usuario que creó la cotización
  - Fecha de creación

### 5. Generar PDF
- **Previsualizar**: Abre el PDF en una nueva ventana
- **Descargar**: Guarda el PDF localmente

**Características del PDF**:
- ✅ Logo de la empresa (con aspect ratio correcto)
- ✅ Datos de contacto de Guerra Laser México
- ✅ Información del cliente
- ✅ Condiciones comerciales
- ✅ Tabla de productos con columnas: SKU, Descripción, Cantidad, Precio, Descuento%, Total
- ✅ Manejo de texto largo (multi-línea)
- ✅ Salto de página automático
- ✅ Totales con descuentos
- ✅ Notas personalizadas
- ✅ Colores corporativos (rojo #DC2626 y azul #2563EB)
- ✅ Pie de página con vigencia

## 📱 Responsive Design

El sistema está completamente optimizado para móviles:
- **Layout adaptable**: Grid responsive que se ajusta a cualquier pantalla
- **Panel lateral sticky**: En desktop se mantiene visible, en móvil se apila
- **Campos organizados**: 1 columna en móvil, hasta 3 en desktop
- **Botones fijos**: En la parte inferior para fácil acceso

## 📊 Estructura de Datos

### Tabla: `quotations`
```
- id (UUID, PK)
- quotation_number (VARCHAR, UNIQUE) → Generado automáticamente
- customer_name (VARCHAR, NOT NULL)
- customer_company (VARCHAR)
- customer_rfc (VARCHAR)
- customer_email (VARCHAR)
- customer_phone (VARCHAR)
- customer_address (TEXT)
- subtotal (DECIMAL)
- general_discount_percentage (DECIMAL)
- general_discount_amount (DECIMAL)
- total (DECIMAL)
- validity_days (INTEGER, default: 15)
- payment_terms (VARCHAR, default: 'Contado')
- notes (TEXT)
- status (VARCHAR, default: 'draft') → draft, sent, accepted, rejected
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
- created_by (UUID, FK → auth.users)
```

### Tabla: `quotation_items`
```
- id (UUID, PK)
- quotation_id (UUID, FK → quotations)
- product_id (UUID, FK → products)
- variant_id (UUID, FK → product_variants)
- sku (VARCHAR)
- description (TEXT, NOT NULL)
- quantity (INTEGER, NOT NULL)
- unit_price (DECIMAL, NOT NULL)
- line_discount_percentage (DECIMAL)
- total_price (DECIMAL, NOT NULL)
- created_at (TIMESTAMPTZ)
```

## 🔐 Seguridad (RLS)

Las políticas de Row Level Security están habilitadas:
- ✅ Solo usuarios autenticados pueden acceder
- ✅ Permisos completos (SELECT, INSERT, UPDATE, DELETE) para usuarios autenticados
- ⚠️ **Nota**: Puedes personalizar las políticas para restringir por roles si es necesario

## 🎯 Flujo de Trabajo Recomendado

1. **Acceder**: Dashboard → Crear Cotización
2. **Llenar datos del cliente**: Mínimo el nombre (obligatorio)
3. **Buscar y agregar productos**: Usar el panel lateral
4. **Editar cantidades y precios**: Ajustar según necesidad
5. **Aplicar descuentos**: Por línea o general
6. **Guardar**: Presionar "💾 Guardar Cotización" (genera número automático)
7. **Generar PDF**: Previsualizar o descargar
8. **Nueva cotización**: Usar "Limpiar todo" para empezar de cero

## 🔧 Mantenimiento

### Consultar cotizaciones guardadas
```sql
SELECT 
  q.quotation_number,
  q.customer_name,
  q.total,
  q.status,
  q.created_at
FROM quotations q
ORDER BY q.created_at DESC;
```

### Ver items de una cotización específica
```sql
SELECT 
  qi.sku,
  qi.description,
  qi.quantity,
  qi.unit_price,
  qi.total_price
FROM quotation_items qi
WHERE qi.quotation_id = 'TU_UUID_AQUI';
```

### Cambiar estado de cotización
```sql
UPDATE quotations 
SET status = 'sent' -- o 'accepted', 'rejected'
WHERE id = 'TU_UUID_AQUI';
```

## 📝 Notas Importantes

1. **Logo**: Asegúrate de tener el archivo `/static/logorectangular.png` en tu proyecto
2. **Autenticación**: El sistema requiere que el usuario esté autenticado en Supabase
3. **Productos**: Los productos deben tener `base_price` y `stock_quantity` configurados
4. **Número automático**: Se genera en formato `YYYY-000001` (año + 6 dígitos)
5. **Campos obligatorios**: Solo el nombre del cliente es obligatorio para guardar

## 🐛 Troubleshooting

### Error: "No se puede generar número de cotización"
- **Causa**: La función `generate_quotation_number()` no existe
- **Solución**: Ejecuta el SQL de migración completo

### Error: "No se pueden guardar los items"
- **Causa**: Las tablas no tienen las políticas RLS correctas
- **Solución**: Verifica que las políticas RLS estén activas

### El PDF no muestra el logo
- **Causa**: Archivo no encontrado en `/static/logorectangular.png`
- **Solución**: Coloca el logo en la ruta correcta

### Los productos no se muestran en la búsqueda
- **Causa**: Productos inactivos o sin precio base
- **Solución**: Verifica que los productos tengan `is_active = true` y `base_price` configurado

## 🚧 Futuras Mejoras (Opcionales)

- [ ] Listado de cotizaciones guardadas
- [ ] Edición de cotizaciones existentes
- [ ] Envío por email desde la aplicación
- [ ] Conversión de cotización a pedido
- [ ] Exportar múltiples cotizaciones a Excel
- [ ] Plantillas de cotización personalizables
- [ ] Firma digital del cliente
- [ ] Seguimiento de estado (enviada, aceptada, rechazada)

---

**Desarrollado para Guerra Laser México** 🔷✨
