# Google Analytics (gtag) Integration Guide

## Resumen de Implementación

Se ha implementado Google Analytics (gtag.js) en tu aplicación Svelte con las siguientes características:

### 1. ✅ Script Global de gtag.js
- **Ubicación**: [src/app.html](src/app.html)
- **ID de gtag**: `G-EG2D20MZJ8`
- Se carga automáticamente en el `<head>` con atributo `async`

### 2. ✅ Rastreo de SPA (Single Page Application)
- **Ubicación**: [src/routes/+layout.svelte](src/routes/+layout.svelte)
- Los cambios de URL disparan automáticamente eventos `page_view`
- Funciona con el store `$page` de SvelteKit

### 3. ✅ Utilidades Reutilizables
- **Ubicación**: [src/lib/gtag.ts](src/lib/gtag.ts)
- Todas las funciones verifican que `gtag` esté disponible antes de ejecutar
- Safe para lado del cliente (server-safe)

### 4. ✅ Evento de Contacto WhatsApp
- **Evento**: `contact_whatsapp`
- **Ubicación**: [src/routes/+layout.svelte](src/routes/+layout.svelte) (función `sendWhatsApp`)
- Se dispara cuando el usuario usa el botón flotante de WhatsApp

---

## Uso en tu Código

### Rastrear un page_view manual
```typescript
import { trackPageView } from '$lib/gtag';

trackPageView('/mi-pagina', 'Mi Página');
```

### Rastrear un evento personalizado
```typescript
import { trackEvent } from '$lib/gtag';

trackEvent('mi_evento', {
  categoria: 'productos',
  valor: 100
});
```

### Rastrear contacto por WhatsApp
```typescript
import { trackWhatsAppContact } from '$lib/gtag';

trackWhatsAppContact('desde_producto_xyz');
```

### Rastrear una conversión
```typescript
import { trackConversion } from '$lib/gtag';

trackConversion('purchase', 250.00, 'MXN');
```

---

## Dónde ver los datos en Google Analytics

1. Ve a [Google Analytics](https://analytics.google.com/)
2. Selecciona tu propiedad con ID: `G-EG2D20MZJ8`
3. **Rastreos en tiempo real**: Reports → Realtime
4. **Page views**: Reports → Engagement → Pages and screens
5. **Eventos personalizados**: Reports → Events

---

## Eventos Configurados

| Evento | Descripción | Dispara Desde |
|--------|-------------|---------------|
| `page_view` | Cambio de página (SPA) | Auto en cada ruta |
| `contact_whatsapp` | Usuario hace clic en WhatsApp | Botón flotante |

---

## Notas de Seguridad

✅ Todas las funciones en `gtag.ts` verifican:
- Que `window` esté definido (SSR-safe)
- Que `gtag` esté disponible (client-safe)

✅ No hay datos sensibles siendo rastreados

✅ Usa `encodeURIComponent()` para datos dinámicos

---

## Próximos Pasos Sugeridos

- [ ] Rastrear clics en productos
- [ ] Rastrear completar checkout
- [ ] Rastrear búsquedas
- [ ] Configurar conversiones en Google Analytics
- [ ] Vincular con Google Ads para remarketing
