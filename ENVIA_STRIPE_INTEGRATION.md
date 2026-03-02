# Integración Envia.com + Stripe - Guía Completa

**Fecha**: 2 de Marzo, 2026
**Estado**: ✅ Implementación Completa

## 📋 Descripción General

Sistema completo de e-commerce con:
- ✅ **Cotización automática de envíos** con Envia.com
- ✅ **Generación automática de guías de envío**
- ✅ **Procesamiento de pagos** con Stripe
- ✅ **Tracking de paquetes** en tiempo real
- ✅ **Flow completo de checkout** con validación

---

## 🚀 Características Implementadas

### 1. Integración Envia.com

#### Servicio de Envíos (`src/lib/services/enviaService.ts`)
- ✅ Cotización de tarifas de múltiples paqueterías (FedEx, DHL, Estafeta, etc.)
- ✅ Generación automática de guías de envío
- ✅ Tracking de paquetes
- ✅ Cancelación de envíos
- ✅ Cálculo automático de dimensiones y pesos por tipo de producto

#### Endpoints API
- **`POST /api/shipping/quote`**: Cotizar opciones de envío
- **`POST /api/shipping/create`**: Crear guía de envío
- **`GET /api/shipping/track`**: Rastrear paquete

### 2. Integración Stripe

#### Procesamiento de Pagos
- ✅ Stripe Elements integrado en checkout
- ✅ Payment Intents para pagos seguros
- ✅ Confirmación automática de pagos
- ✅ Webhooks para actualizaciones asíncronas

#### Endpoints API
- **`POST /api/stripe/create-payment-intent`**: Crear intención de pago
- **`POST /api/stripe/confirm-payment`**: Confirmar pago
- **`POST /api/stripe/webhook`**: Recibir eventos de Stripe

### 3. Flow de Checkout Mejorado

#### Página de Checkout (`/checkout`)
1. **Información del cliente** (nombre, email, teléfono)
2. **Dirección de envío** (calle, ciudad, estado, CP)
3. **Cotización de envíos** (consulta automática a Envia.com)
4. **Selección de paquetería** (múltiples opciones con precios y tiempos)
5. **Método de pago** (Stripe Elements integrado)
6. **Confirmación y pago** (proceso seguro)

#### Generación Automática
Al completar el pago:
- ✅ Se crea la orden en la base de datos
- ✅ Se procesa el pago con Stripe
- ✅ Se genera automáticamente la guía de envío con Envia.com
- ✅ Se actualiza la orden con número de tracking
- ✅ Se redirige al cliente a la página de confirmación

### 4. Página de Confirmación

#### Vista de Pedido (`/pedido/[orderNumber]`)
- ✅ Número de pedido y estado
- ✅ Información del cliente y dirección
- ✅ Detalles de envío (paquetería, servicio, tracking)
- ✅ Botón para descargar guía de envío
- ✅ Botón para rastrear paquete en tiempo real
- ✅ Resumen de productos y totales

---

## 🗄️ Base de Datos

### Migración de Campos de Tracking

**Archivo**: `database/migrations/20260302000000_add_shipping_tracking.sql`

Nuevos campos en tabla `orders`:
```sql
- shipping_carrier VARCHAR(50)          -- 'fedex', 'dhl', 'estafeta', etc.
- shipping_service VARCHAR(100)         -- 'express', 'standard', etc.
- shipping_tracking_number VARCHAR(100) -- Número de rastreo
- shipping_label_url TEXT               -- URL para descargar guía PDF
- shipping_cost DECIMAL(10, 2)          -- Costo real del envío
- shipping_status VARCHAR(50)           -- Estado del envío
- stripe_payment_intent_id VARCHAR(255) -- ID de Payment Intent de Stripe
```

**Estados de envío disponibles**:
- `pending`: Pendiente
- `quote_requested`: Cotización solicitada
- `quote_sent`: Cotización enviada
- `label_created`: Etiqueta creada ✅
- `picked_up`: Recolectado
- `in_transit`: En tránsito
- `out_for_delivery`: En reparto
- `delivered`: Entregado
- `failed`: Fallo en entrega
- `returned`: Devuelto
- `cancelled`: Cancelado

### Ejecutar Migración

```bash
# Desde el dashboard de Supabase (SQL Editor)
# Ejecuta el contenido de: database/migrations/20260302000000_add_shipping_tracking.sql

# O desde terminal con Supabase CLI
supabase db push
```

---

## ⚙️ Configuración

### 1. Variables de Entorno

Crea un archivo `.env` con las siguientes variables:

```bash
# Supabase
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Envia.com
VITE_ENVIA_API_TOKEN=tu-token-de-envia
```

### 2. Obtener Credenciales de Envia.com

1. Regístrate en [Envia.com](https://ship.envia.com/registrate/)
2. Accede al Dashboard
3. Ve a **Configuración → API**
4. Copia tu **Token de API**
5. Pega el token en `VITE_ENVIA_API_TOKEN`

### 3. Configurar Stripe

#### A. Obtener API Keys
1. Ve a [Stripe Dashboard](https://dashboard.stripe.com/)
2. Click en **Developers → API Keys**
3. Copia:
   - **Publishable key** → `VITE_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY`

#### B. Configurar Webhook
1. Ve a **Developers → Webhooks**
2. Click en **Add endpoint**
3. URL del endpoint: `https://tu-dominio.com/api/stripe/webhook`
4. Selecciona eventos:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copia el **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 4. Actualizar Dirección de Origen (Envia.com)

Edita `src/lib/services/enviaService.ts` función `getOriginAddress()`:

```typescript
export function getOriginAddress(): EnviaAddress {
	return {
		name: 'Guerra Laser México',
		company: 'Guerra Laser México',
		email: 'ventas@guerralaser.com.mx',
		phone: '5555555555', // ← Actualiza con tu teléfono
		street: 'Av. Principal 123', // ← Actualiza con tu dirección
		city: 'Ciudad de México', // ← Actualiza tu ciudad
		state: 'CDMX', // ← Actualiza tu estado
		country: 'MX',
		postalCode: '01000' // ← Actualiza tu código postal
	};
}
```

---

## 🧪 Pruebas

### Probar Cotización de Envíos

```bash
curl -X POST http://localhost:5173/api/shipping/quote \
  -H "Content-Type: application/json" \
  -d '{
    "cartItems": [{
      "product": {"id": "...", "name": "Test Product", "base_price": 1000},
      "quantity": 1
    }],
    "destination": {
      "street": "Av. Reforma 123",
      "city": "Guadalajara",
      "state": "Jalisco",
      "zip": "44100",
      "country": "MX"
    },
    "customerInfo": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "3312345678"
    }
  }'
```

### Probar Pago con Stripe (Tarjetas de Prueba)

Usa estas tarjetas en el checkout:

**Tarjeta exitosa**:
- Número: `4242 4242 4242 4242`
- Fecha: Cualquier fecha futura
- CVC: Cualquier 3 dígitos
- ZIP: Cualquier código postal

**Tarjeta que requiere 3D Secure**:
- Número: `4000 0027 6000 3184`

**Tarjeta rechazada**:
- Número: `4000 0000 0000 0002`

[Más tarjetas de prueba](https://stripe.com/docs/testing)

---

## 📱 Flow de Usuario

### Flow Normal (Productos Estándar/Delicados)

1. Usuario agrega productos al carrito
2. Va a `/checkout`
3. Llena información de contacto y dirección
4. Click en **"Consultar Opciones de Envío"**
   - Sistema consulta automáticamente a Envia.com
   - Muestra opciones con precios y tiempos de entrega
5. Selecciona método de envío preferido
6. Aparece formulario de pago de Stripe
7. Ingresa datos de tarjeta
8. Click en **"Pagar y Finalizar Compra"**
   - Se procesa el pago con Stripe
   - Se crea la orden en la DB
   - Se genera automáticamente la guía con Envia.com
   - Se actualiza la orden con tracking
9. Redirección a `/pedido/[numero]?payment=success`
   - Muestra confirmación de pago
   - Muestra número de tracking
   - Botón para descargar guía
   - Botón para rastrear paquete

### Flow Especial (Equipos Pesados)

1. Usuario agrega maquinaria pesada al carrito
2. Va a `/checkout`
3. Sistema detecta items pesados automáticamente
4. Muestra modal de **"Solicitar Cotización de Envío"**
5. Usuario llena formulario
6. Se crea solicitud de cotización en la DB
7. Asesor contacta al cliente en 30 minutos
8. Se envía cotización personalizada por email

---

## 🔧 Archivos Principales

### Servicios
- `src/lib/services/enviaService.ts` - Integración Envia.com
- `src/lib/services/shippingResolver.ts` - Lógica de tipos de envío

### Endpoints API
- `src/routes/api/shipping/quote/+server.ts` - Cotizar envíos
- `src/routes/api/shipping/create/+server.ts` - Crear guía
- `src/routes/api/shipping/track/+server.ts` - Rastrear paquete
- `src/routes/api/stripe/create-payment-intent/+server.ts` - Crear pago
- `src/routes/api/stripe/confirm-payment/+server.ts` - Confirmar pago
- `src/routes/api/stripe/webhook/+server.ts` - Webhooks Stripe

### Páginas
- `src/routes/checkout/+page.svelte` - Checkout completo
- `src/routes/pedido/[orderNumber]/+page.svelte` - Confirmación y tracking

### Base de Datos
- `database/migrations/20260302000000_add_shipping_tracking.sql` - Migración

---

## 🎯 Próximos Pasos Opcionales

### Mejoras Sugeridas

1. **Email Notifications**
   - Enviar email de confirmación con número de tracking
   - Notificaciones de cambios de estado del envío
   - Integrar con Resend o SendGrid

2. **Dashboard Admin**
   - Vista de todos los pedidos con estados
   - Generar guías masivas
   - Reportes de ventas y envíos

3. **Tracking Automático**
   - Webhook de Envia.com para actualizaciones de estado
   - Actualización automática de `shipping_status`
   - Timeline visual del tracking en la página del pedido

4. **Cálculos de Peso/Dimensiones**
   - Agregar campos `weight`, `length`, `width`, `height` a productos
   - Usar valores reales en lugar de estimados
   - Mejorar precisión de cotizaciones

5. **Multi-paquete**
   - Detectar cuando se requieren múltiples paquetes
   - Generar múltiples guías si es necesario
   - Tracking individual por paquete

---

## 📚 Referencias

### Documentación
- [Envia.com API Docs](https://api.envia.com/doc)
- [Stripe API Docs](https://stripe.com/docs/api)
- [Stripe Elements](https://stripe.com/docs/payments/elements)
- [SvelteKit Forms](https://kit.svelte.dev/docs/form-actions)

### Soporte
- Envia.com: [soporte@envia.com](mailto:soporte@envia.com)
- Stripe: [Dashboard Support](https://dashboard.stripe.com/support)

---

## ✅ Checklist de Implementación

- [x] Servicio de integración con Envia.com
- [x] Endpoints API para cotización de envíos
- [x] Endpoint para generar guías de envío
- [x] Endpoint para tracking
- [x] Integración completa de Stripe en checkout
- [x] UI actualizada con opciones de envío
- [x] Stripe Elements para pagos
- [x] Página de confirmación con tracking
- [x] Migración de base de datos
- [x] Documentación completa
- [x] Variables de entorno configuradas

---

## 🎉 ¡Implementación Completa!

Tu sistema de e-commerce ahora cuenta con:
- ✅ Cotización automática de envíos
- ✅ Múltiples opciones de paqueterías
- ✅ Generación automática de guías
- ✅ Procesamiento seguro de pagos con Stripe
- ✅ Tracking en tiempo real
- ✅ Flow completo de checkout

**¿Necesitas ayuda?** Revisa los logs de la consola del navegador y del servidor para debugging.
