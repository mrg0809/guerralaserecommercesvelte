# Sistema Multi-Tipo de Envíos - Guía de Implementación

**Fecha**: 25 de Febrero, 2026
**Estado**: Implementación Completa

## 📋 Resumen de Cambios

Se ha implementado un sistema parametrizable de clasificación de envíos que detecta automáticamente si un carrito contiene equipos pesados (maquinaria, chillers, compresores, extractores) y cambia el flujo de checkout para mostrar un botón "Cotizar Envío" en lugar de "Comprar", con un modal para capturar información de entrega.

## 🗄️ Base de Datos

### Nuevas Tablas

#### 1. **`shipping_types`** - Tipos de envío parametrizables

```sql
- id (UUID, PK)
- name (VARCHAR UNIQUE) - 'standard', 'delicate', 'heavy'
- description (TEXT)
- is_active (BOOLEAN)
- requires_quotation (BOOLEAN) - true para tipo 'heavy'
- requires_special_handling (BOOLEAN) - true para tipo 'delicate'
- Timestamps
```

**Datos semilla**:
- `standard`: Refacciones y consumibles (FedEx $250/$350)
- `delicate`: Tubos láser (Envío especial $350)
- `heavy`: Maquinaria (Requiere cotización manual)

#### 2. **`shipping_methods`** - Métodos de envío por tipo

```sql
- id (UUID, PK)
- shipping_type_id (UUID, FK)
- name (VARCHAR) - 'FedEx Standard', 'FedEx Express', etc.
- carrier (VARCHAR) - 'fedex', 'dhl', 'local'
- description (TEXT)
- base_price (DECIMAL)
- is_active (BOOLEAN)
- display_order (INTEGER)
- Timestamps
```

**Datos semilla**:
- Standard → FedEx Standard ($250), FedEx Express ($350)
- Delicate → Special Packaging + Courier ($350)

#### 3. **`quotation_requests`** - Solicitudes de cotización

```sql
- id (UUID, PK)
- user_id (UUID, FK)
- customer_name, customer_email, customer_phone (VARCHAR)
- delivery_address_* (VARCHAR) - street, city, state, zip, country
- items (JSONB) - Carrito en el momento de solicitud
- estimated_subtotal, estimated_tax (DECIMAL)
- notes (TEXT)
- status (VARCHAR) - 'pending', 'quoted', 'accepted', 'rejected'
- quoted_price (DECIMAL) - Precio final cotizado
- quoted_at, expires_at (TIMESTAMP)
- Timestamps
```

#### 4. **`products.shipping_type_id`** - Nueva columna en tabla existente

Se agrega FK a `shipping_types` para clasificar cada producto.

**Clasificación automática**:
- **HEAVY**: Todas las categorías bajo `maquinaria/*`, `router-cnc*`, `cnc-plasma`, `plasma`, `tornos`, `centros-maquinado`, `dobladora*`, `chillers*`, `compresores*`, `extractores*`, `bombas*`
- **DELICATE**: `tubos-laser*`, `tubo-co2*`, `tubo-rf*`
- **STANDARD**: Resto de productos

## 🔧 Migraciones SQL

Ejecutar en orden:

```bash
# 1. Crear tablas de shipping
supabase migration:push 20260225000000_create_shipping_types.sql

# 2. Crear tabla de cotizaciones
supabase migration:push 20260225000001_create_quotation_requests.sql

# 3. Agregar shipping_type a productos
supabase migration:push 20260225000002_add_shipping_type_to_products.sql
```

## 💻 Cambios en Frontend

### 1. **Servicio: `shippingResolver.ts`**
- Detecta si carrito contiene items `heavy`
- Resuelve tipo de envío: 'standard', 'delicate', 'heavy'
- Proporciona labels y botones según tipo

### 2. **Endpoint API: `/api/shipping/methods` (POST)**
- Recibe tipo de envío + ubicación destino
- Retorna métodos disponibles con precios
- Usa tabla `shipping_methods` para obtener opciones

### 3. **Endpoint API: `/api/quotations/shipping` (POST)**
- Recibe solicitud de cotización (cliente, dirección, carrito)
- Inserta en tabla `quotation_requests`
- Estado inicial: 'pending'
- TODO: Enviar email de notificación al equipo

### 4. **Endpoint API: `/api/stripe/create-payment-intent` (POST)**
- Crea Stripe PaymentIntent
- Requiere `STRIPE_SECRET_KEY` en `.env`

### 5. **Checkout: `/routes/checkout/+page.svelte`**

**Flujo nuevo**:

```
1. Detecta shipping_type del carrito
   ↓
2. Si hay "heavy" → Muestra modal de cotización
   ├─ Captura: nombre, email, teléfono, dirección
   ├─ Botón: "Solicitar Cotización"
   └─ Redirige a: /cotizacion-enviada?id={quotationId}

3. Si NO hay "heavy" → Muestra checkout normal
   ├─ Botón: "Comprar"
   ├─ Crea Payment Intent en Stripe
   ├─ Crea orden en DB
   └─ Redirige a: /pedido/{orderNumber}?payment=pending
```

### 6. **Google Merchant Feed: `/routes/feed/google.xml/+server.ts`**

Ahora incluye etiqueta `<g:shipping>` para items pesados:

```xml
<g:shipping>
  <g:country>MX</g:country>
  <g:service>Flete especializado / A convenir</g:service>
  <g:price>0.00 MXN</g:price>
</g:shipping>
```

Esto le comunica a Google que el precio del envío se cotiza por separado.

### 7. **Página de Producto: `/routes/productos/[slug]/+page.ts`**

Ahora carga `shipping_types` relación:

```typescript
.select('...*, shipping_types(name)')
```

Al agregar item al carrito, se pasa `shipping_type_name` para detectar heavy items.

## 🔐 Configuración Requerida

### Variables de Entorno

Agregar a `.env.local`:

```env
# Stripe (REQUIERO CREDENCIALES REALES)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx

# Opcionales (para mejora futura)
FEDEX_API_KEY=xxxxx
FEDEX_SECRET_KEY=xxxxx
```

### Permisos RLS en Supabase

✅ Automáticos: Todas las tablas nuevas tienen RLS habilitado con políticas de:
- Lectura pública para `shipping_types` y `shipping_methods`
- Lectura usuario-propio para `quotation_requests`
- Actualización solo para admin en `quotation_requests`

## 📱 Páginas Nuevas (A crear)

### `/cotizacion-enviada`

Página de confirmación después de solicitar cotización:

```svelte
<h1>¡Cotización Enviada!</h1>
<p>Referencia: {quotationId}</p>
<p>Nos contactaremos en menos de 30 minutos</p>
```

## 🧪 Testing Checklist

- [ ] Migrations ejecutadas exitosamente
- [ ] Tabla `shipping_types` contiene 3 registros (standard, delicate, heavy)
- [ ] Tabla `shipping_methods` contiene 3 métodos
- [ ] Productos clasificados correctamente (ejecutar SELECT COUNT por type)
- [ ] Agregar producto "heavy" al carrito → Muestra modal
- [ ] Modal de cotización funciona
- [ ] API `/api/quotations/shipping` inserta correctamente
- [ ] Google Merchant feed genera XML con etiquetas de shipping
- [ ] Stripe Payment Intent se crea sin errores (verificar logs)

## 🔄 Flujos Completados

### Estándar (Refacciones, Consumibles)
```
Producto → Carrito → Checkout → Seleccionar Envío → Stripe Payment → Orden
              ↓
        shipping_type: 'standard'
        Mostrar: FedEx Standard ($250) + FedEx Express ($350)
```

### Delicado (Tubos Láser)
```
Producto → Carrito → Checkout → Seleccionar Envío → Stripe Payment → Orden
              ↓
        shipping_type: 'delicate'
        Mostrar: Embalaje Especial + Central ($350)
```

### Pesado/Especial (Maquinaria)
```
Producto → Carrito → MODAL COTIZACIÓN → Email → Asesor Cotiza → Payment Link → Orden
              ↓
        shipping_type: 'heavy'
        Botón: "Cotizar Envío"
        Flujo bloqueado hasta obtener cotización exacta
```

## 📧 TODO: Integración con Email (Mejora Futura)

En `/api/quotations/shipping/+server.ts`, descomentar:

```typescript
// TODO: Implementar
await sendQuotationNotificationEmail({
  quotationId: data.id,
  customer: {...},
  items: {...},
  deliveryAddress: {...}
});
```

Usar servicio como SendGrid, Resend o SMTP para notificar al equipo de ventas.

## 💳 TODO: Integración Real con FedEx (Mejora Futura)

Actualmente usa tarifas planas ($250/$350). Para integración real con FedEx:

1. Obtener credenciales FedEx API
2. Crear servicio `fedexService.ts`
3. Calcular peso del carrito
4. Llamar FedEx API en `/api/shipping/methods`

## 🔍 Queries Útiles para Admin

```sql
-- Ver todas las solicitudes de cotización
SELECT * FROM quotation_requests 
ORDER BY created_at DESC;

-- Cotizaciones pendientes
SELECT * FROM quotation_requests 
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Productos por tipo de envío
SELECT p.name, st.name as shipping_type, COUNT(*) as count
FROM products p
LEFT JOIN shipping_types st ON p.shipping_type_id = st.id
GROUP BY p.shipping_type_id, st.name
ORDER BY st.name;

-- Métodos de envío disponibles
SELECT st.name, sm.name, sm.base_price
FROM shipping_types st
LEFT JOIN shipping_methods sm ON st.id = sm.shipping_type_id
WHERE st.is_active = true AND sm.is_active = true;
```

## 📞 Soporte

Para cambiar tarifas, carriers o agregar nuevos tipos de envío:

1. Admin panel → Actualizar tabla `shipping_types` (si aplica)
2. Admin panel → Actualizar tabla `shipping_methods` (tarifas/carriers)
3. Datos se sincronizar automáticamente en checkout

**No requiere redeploy** ✨

---

**Implementación completada**: 25/02/2026  
**Próximos pasos**: Configurar claves Stripe, crear página `/cotizacion-enviada`, setup de notificaciones email
