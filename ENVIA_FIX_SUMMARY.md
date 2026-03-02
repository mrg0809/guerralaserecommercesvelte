# 🐛 Solución: Envia.com Retorna Tarifas Vacías

## Problema Identificado

Cuando presionas "Consultar Opciones de Envío", recibes:
```json
{"success":true,"rates":[]}
```

## ✅ Soluciones Implementadas

### 1. **Sistema de Fallback con Tarifas de Prueba**

Si no hay token configurado, el sistema ahora retorna tarifas de prueba automáticamente:
```json
{
  "warning": "Envia.com token not configured - using mock rates for testing",
  "success": true,
  "rates": [
    {"carrier": "fedex", "service": "standard", "price": 250, ...},
    {"carrier": "fedex", "service": "express", "price": 350, ...},
    {"carrier": "estafeta", "service": "standard", "price": 280, ...}
  ]
}
```

### 2. **Logging Detallado para Debugging**

Se agregó logging completo en el servidor y en Envia:

```
[SHIPPING QUOTE] Request received: {...}
[SHIPPING QUOTE] Packages calculated: [...]
[ENVIA] POST https://api.envia.com/ship/rate/
[ENVIA] Request body: {...}
[ENVIA] Response status: 200
[ENVIA] Response body: {...}
[SHIPPING QUOTE] Rates from Envia: [...]
```

### 3. **Página de Prueba**

Nueva página en `/test-envia` para probar la integración:
- Formulario con datos de prueba
- Visualización de resultados
- Debug en tiempo real

---

## 🚀 Pasos Siguientes

### Paso 1: Obtener Token de Envia.com

```bash
# Ve a https://ship.envia.com/
# 1. Inicia sesión
# 2. Configuración → API → Tokens
# 3. Copia tu token (ej: token_abc123...)
```

### Paso 2: Configurar en .env

```bash
# Abre .env y agrega:
VITE_ENVIA_API_TOKEN=tu_token_aqui
```

**Importante**: Reinicia el servidor después:
```bash
npm run dev
# o
yarn dev
```

### Paso 3: Verificar Configuración

Abre http://localhost:5173/test-envia

Deberías ver:
- ✅ Token Envia.com: CONFIGURADO
- Presiona "Probar Cotización"
- Deberías recibir tarifas reales de Envia.com

---

## 🔍 Cómo Debuggear

### Ver Logs del Servidor

En la terminal donde corre `npm run dev`, verás:

```
[SHIPPING QUOTE] Request received: { cartItemsCount: 1, ... }
[SHIPPING QUOTE] Origin address: { ... }
[SHIPPING QUOTE] Destination address: { ... }
[SHIPPING QUOTE] Packages calculated: [ ... ]
[ENVIA] POST https://api.envia.com/ship/rate/
[ENVIA] Request body: { ... }
[ENVIA] Response status: 200
[ENVIA] Response body: { "data": [ ... ] }
[SHIPPING QUOTE] Rates from Envia: [ ... ]
```

### Ver Logs en el Navegador

1. Abre DevTools (F12)
2. Ve a **Console**
3. Presiona "Probar Cotización" en `/test-envia`
4. Verás los logs de la solicitud

### Revisar Respuesta de la API

1. Abre DevTools (F12)
2. Ve a **Network**
3. Presiona "Probar Cotización"
4. Haz click en el request `/api/shipping/quote`
5. Ve la pestaña **Response** para ver la respuesta completa

---

## ⚠️ Solución de Problemas

### "Envia.com token not configured"
- [ ] Verificar que `.env` tiene `VITE_ENVIA_API_TOKEN=...`
- [ ] Reiniciar el servidor: `npm run dev`
- [ ] Verificar que no hay espacios al inicio/final del token

### "Response status: 401" (Unauthorized)
- [ ] El token es inválido o expirado
- [ ] Ir a https://ship.envia.com/ y verificar el token
- [ ] Generar un nuevo token si es necesario

### "Response status: 400" (Bad Request)
- [ ] Los datos enviados no cumplen el formato de Envia.com
- [ ] Ver los logs para verificar qué se está enviando
- [ ] Revisar la dirección de destino (código postal, estado, ciudad)

### "No hay tarifas disponibles"
- [ ] El destino no está cubierto por Envia.com
- [ ] Intenta con otra ciudad/estado
- [ ] Verifica el código postal en Google Maps

---

## 📝 Archivos Actualizados

### Servicios
- ✅ [src/lib/services/enviaService.ts](src/lib/services/enviaService.ts) - Logging mejorado
- ✅ [src/routes/api/shipping/quote/+server.ts](src/routes/api/shipping/quote/+server.ts) - Debugging detallado

### Nueva Documentación
- ✅ [ENVIA_DEBUGGING_GUIDE.md](ENVIA_DEBUGGING_GUIDE.md) - Guía completa
- ✅ [src/routes/test-envia/+page.svelte](src/routes/test-envia/+page.svelte) - Página de prueba

---

## 🎯 Próximos Pasos

1. **Obtén tu token de Envia.com** (si aún no lo tienes)
2. **Configúralo en `.env`**
3. **Reinicia el servidor**
4. **Prueba en `/test-envia`**
5. **Si hay problemas, revisa los logs**

¡El sistema está listo para usar! 🚀
