# Debugging de Integración Envia.com

## 🐛 Problema: Ninguna tarifa retornada

Si estás viendo `{"success":true,"rates":[]}`, significa que:

1. **El endpoint está funcionando** ✅
2. **Los datos se están enviando correctamente** ✅  
3. **Pero Envia.com no está retornando tarifas** ❌

### Causas Comunes

#### 1. Token de Envia.com No Configurado ⚠️

**Síntoma**: En los logs del servidor ves:
```
[ENVIA] No token configured, returning empty response
```

**Solución**:

1. **Obtén tu token de Envia.com**:
   - Ve a https://ship.envia.com/
   - Inicia sesión en tu cuenta
   - Ve a **Configuración → API → Tokens**
   - Copia tu token (empieza con algo como `token_...`)

2. **Configúralo en `.env`**:
   ```bash
   VITE_ENVIA_API_TOKEN=tu_token_aqui
   ```

3. **En modo development**:
   - Si usas Vite/SvelteKit, los cambios en `.env` requieren reiniciar:
     ```bash
     npm run dev
     # o
     yarn dev
     ```

4. **En Vercel (producción)**:
   - Ve a tu proyecto en Vercel
   - **Settings → Environment Variables**
   - Agrega: `VITE_ENVIA_API_TOKEN=tu_token`
   - Redeploy

#### 2. Token Inválido o Expirado

**Síntoma**: En los logs ves:
```
[ENVIA] Response status: 401
[ENVIA] ❌ Request failed: Error: Unauthorized
```

**Solución**:

1. Verifica que el token sea correcto (sin espacios al inicio/final)
2. En el dashboard de Envia.com, revisa que el token esté activo
3. Genera un nuevo token si es necesario

#### 3. Datos de Solicitud Inválidos

**Síntoma**: En los logs ves:
```
[ENVIA] Response status: 400
[ENVIA] ❌ Request failed: Error: Invalid request
```

**Solución**: Revisa que los datos cumplan con el formato de Envia:

```json
{
  "origin": {
    "name": "Tu Empresa",
    "email": "correo@empresa.com",
    "phone": "1234567890",
    "street": "Calle 123",
    "city": "Ciudad",
    "state": "Estado",
    "country": "MX",
    "postalCode": "12345"
  },
  "destination": {
    "name": "Cliente",
    "email": "cliente@email.com",
    "phone": "9876543210",
    "street": "Calle 456",
    "city": "Ciudad",
    "state": "Estado",
    "country": "MX",
    "postalCode": "54321"
  },
  "packages": [
    {
      "content": "Productos",
      "amount": 1,
      "type": "box",
      "weight": 1.5,
      "insurance": 100,
      "declaredValue": 1000,
      "weightUnit": "KG",
      "lengthUnit": "CM",
      "dimensions": {
        "length": 40,
        "width": 30,
        "height": 20
      }
    }
  ]
}
```

#### 4. Destino No Válido

**Síntoma**: En los logs ves:
```
[ENVIA] Response status: 400
[ENVIA] ❌ Request failed: Error: Destination not serviceable
```

**Solución**: 

- No todos los estados/ciudades de México son cubiertos por todas las paqueterías
- Verifica que el código postal sea válido
- Intenta con una dirección diferente (ej: Guadalajara, CDMX, Monterrey)

---

## 🔍 Cómo Debuggear

### 1. Ver los Logs del Servidor

**En desarrollo (terminal donde corre `npm run dev`)**:

```
[SHIPPING QUOTE] Request received: {
  cartItemsCount: 1,
  destination: { ... },
  customerInfo: { ... }
}
[SHIPPING QUOTE] Origin address: { ... }
[SHIPPING QUOTE] Destination address: { ... }
[SHIPPING QUOTE] Packages calculated: [ ... ]
[ENVIA] POST https://api.envia.com/ship/rate/
[ENVIA] Request body: { ... }
[ENVIA] Response status: 200
[ENVIA] Response body: { "data": [ ... ] }
[ENVIA RATES] Got rates: [ ... ]
[SHIPPING QUOTE] Rates from Envia: [ ... ]
```

### 2. Ver los Logs en el Navegador

**F12 → Console → Network**:

1. Abre DevTools (F12)
2. Ve a la pestaña **Network**
3. Presiona "Consultar Opciones de Envío"
4. Haz click en el request `/api/shipping/quote`
5. Ve la pestaña **Response** para ver la respuesta
6. Ve la pestaña **Console** para ver errores

### 3. Probar con cURL

```bash
curl -X POST http://localhost:5173/api/shipping/quote \
  -H "Content-Type: application/json" \
  -d '{
    "cartItems": [{
      "product": {
        "id": "test-1",
        "name": "Test Product",
        "base_price": 1000,
        "shipping_type": "standard"
      },
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

---

## 📋 Checklist de Verificación

- [ ] Token de Envia.com obtenido y copiado
- [ ] Variable `VITE_ENVIA_API_TOKEN` configurada en `.env`
- [ ] Servidor reiniciado después de actualizar `.env`
- [ ] Token verificado en el dashboard de Envia.com (no expirado)
- [ ] Dirección de destino válida y con código postal correcto
- [ ] Estado y ciudad disponibles en el catálogo de Envia
- [ ] Logs del servidor muestran el request llegando a Envia
- [ ] Response status es 200 (no 401 ni 400)
- [ ] Los datos en "Packages calculated" son válidos

---

## 🚀 Solución Rápida

**Para probar sin token real**:

El sistema ahora retorna tarifas de prueba automáticamente si no hay token configurado:

```json
{
  "warning": "Envia.com token not configured - using mock rates for testing",
  "success": true,
  "rates": [
    {
      "carrier": "fedex",
      "service": "standard",
      "description": "FedEx Standard (2-3 días)",
      "deliveryDays": 3,
      "price": 250,
      "currency": "MXN"
    },
    // ... más opciones
  ]
}
```

Esto te permite probar el flow completo sin token. Una vez que tengas el token, simplemente:

1. Configúralo en `.env`
2. Reinicia el servidor
3. El sistema usará las tarifas reales de Envia.com

---

## 📞 Soporte

- **Envia.com**: https://support.envia.com
- **Documentación API**: https://api.envia.com/doc
- **Email**: soporte@envia.com
