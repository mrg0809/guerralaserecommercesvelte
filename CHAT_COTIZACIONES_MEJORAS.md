# Mejoras al Chat de Cotizaciones con IA

## 🎯 Resumen de Mejoras Implementadas

Se han implementado las siguientes mejoras al sistema de chat de cotizaciones:

1. **Actualización a Gemini 2.0 Flash Exp** - Modelo más potente y preciso
2. **Búsqueda Semántica con pgvector** - Encuentra productos por similitud, no solo por texto exacto
3. **Chain of Thought (CoT) Prompting** - El modelo analiza paso a paso antes de responder
4. **Corrección ortográfica automática** - Entiende "hoja fierro bordes" como "lámina antiderrapante"

## 📋 Pasos de Implementación

### 1. Instalar Dependencias (si es necesario)

```bash
npm install
```

### 2. Ejecutar Migración SQL en Supabase

Ejecuta el archivo de migración en tu base de datos de Supabase:

```sql
-- Archivo: database/migrations/enable_pgvector_embeddings.sql
```

**Opciones para ejecutar:**

**Opción A: Desde Supabase Dashboard**
1. Ve a tu proyecto en Supabase
2. Navega a SQL Editor
3. Copia y pega el contenido de `database/migrations/enable_pgvector_embeddings.sql`
4. Ejecuta la query

**Opción B: Desde CLI de Supabase**
```bash
supabase db push
```

### 3. Generar Embeddings para Productos Existentes

Ejecuta el script para generar embeddings de todos tus productos:

```bash
# Asegúrate de tener las variables de entorno configuradas en .env
npx tsx scripts/generate-product-embeddings.ts
```

**Variables de entorno necesarias:**
- `PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

El script:
- ✅ Genera embeddings para todos los productos activos
- ✅ Genera embeddings para todas las variantes de productos
- ✅ Muestra progreso en tiempo real
- ✅ Maneja errores automáticamente

### 4. Verificar la Implementación

1. **Verifica que la extensión pgvector esté habilitada:**
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

2. **Verifica que los embeddings se hayan generado:**
```sql
-- Productos con embeddings
SELECT COUNT(*) FROM products WHERE name_embedding IS NOT NULL;

-- Variantes con embeddings
SELECT COUNT(*) FROM product_variants WHERE name_embedding IS NOT NULL;
```

3. **Prueba la búsqueda semántica:**
```sql
-- Ejemplo de búsqueda (necesitas un embedding de prueba)
SELECT * FROM search_products_by_embedding(
    '[0.1, 0.2, ...]'::vector(768),
    0.65,
    5
);
```

## 🚀 Cómo Funciona

### Búsqueda Semántica

**Antes (búsqueda por texto):**
- Usuario: "hoja fierro bordes"
- Sistema: ❌ No encuentra nada (no hay coincidencia exacta)

**Ahora (búsqueda semántica):**
- Usuario: "hoja fierro bordes"
- Sistema: 
  1. Genera embedding del texto
  2. Busca productos similares por vector
  3. ✅ Encuentra "Lámina Antiderrapante" (similitud: 0.85)

### Chain of Thought (CoT)

El modelo ahora piensa en 3 pasos:

**Paso 1: IDENTIFICACIÓN**
- Lee el mensaje completo
- Identifica cliente, productos, cantidades, costos

**Paso 2: CORRECCIÓN Y NORMALIZACIÓN**
- Corrige errores ortográficos
- Normaliza nombres de productos
- Ejemplos:
  - "tubo c02" → "tubo co2"
  - "maquina corte" → "máquina de corte láser"

**Paso 3: EXTRACCIÓN ESTRUCTURADA**
- Genera JSON con información validada
- Aplica precios y descuentos

## 🔧 Configuración Avanzada

### Ajustar el Umbral de Similitud

En `src/routes/api/generate-quotation-chat/+server.ts`:

```typescript
// Línea ~32 y ~64
match_threshold: 0.65  // Valores: 0.0 - 1.0
```

- **0.65** (recomendado): Balance entre precisión y recall
- **0.75**: Más estricto, solo coincidencias muy similares
- **0.55**: Más permisivo, encuentra más productos pero puede ser menos preciso

### Cambiar el Modelo de Gemini

```typescript
// Línea ~181
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
```

Modelos disponibles:
- `gemini-2.0-flash-exp` - Rápido y eficiente (recomendado)
- `gemini-2.0-pro-exp` - Más potente pero más lento
- `gemini-1.5-pro` - Versión estable anterior

## 📊 Mantenimiento

### Generar Embeddings para Nuevos Productos

**Opción 1: Automático (recomendado)**
Crea un trigger en Supabase que genere embeddings automáticamente:

```sql
-- TODO: Implementar trigger para auto-generar embeddings
-- al insertar/actualizar productos
```

**Opción 2: Manual**
Ejecuta el script periódicamente:
```bash
npx tsx scripts/generate-product-embeddings.ts
```

### Monitoreo

Revisa los logs del servidor para ver:
- Similitud de productos encontrados
- Productos que no se encontraron
- Errores en la generación de embeddings

```bash
# Los logs aparecen con el prefijo [LOG]
[LOG] Búsqueda semántica para: "lamina"
[LOG] Producto encontrado: Lámina Antiderrapante (similitud: 0.87)
```

## 🐛 Solución de Problemas

### Error: "function search_products_by_embedding does not exist"
- **Causa**: No se ejecutó la migración SQL
- **Solución**: Ejecuta `database/migrations/enable_pgvector_embeddings.sql`

### Error: "extension vector does not exist"
- **Causa**: pgvector no está habilitado en Supabase
- **Solución**: Contacta a soporte de Supabase o habilita la extensión manualmente

### No encuentra productos
- **Causa**: Los embeddings no se han generado
- **Solución**: Ejecuta `npx tsx scripts/generate-product-embeddings.ts`

### Productos incorrectos en los resultados
- **Causa**: Umbral de similitud muy bajo
- **Solución**: Aumenta `match_threshold` a 0.70 o 0.75

## 📈 Mejoras Futuras

- [ ] Trigger automático para generar embeddings en nuevos productos
- [ ] Cache de embeddings frecuentes
- [ ] Análisis de sentimiento en mensajes de clientes
- [ ] Sugerencias de productos relacionados
- [ ] Historial de conversación persistente

## 🎓 Recursos

- [Documentación de pgvector](https://github.com/pgvector/pgvector)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Supabase Vector Search](https://supabase.com/docs/guides/ai/vector-search)

---

**Desarrollado con ❤️ para Guerra Láser México**
