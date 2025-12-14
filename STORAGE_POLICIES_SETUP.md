# Guía Rápida: Configurar Políticas de Almacenamiento

## Problema
Error: "new row violates row-level security policy" al intentar subir imágenes al bucket.

## Solución

### Opción 1: Desde el Panel de Supabase (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **SQL Editor** en el menú lateral
3. Haz clic en **+ New query**
4. Copia y pega el contenido del archivo: `database/migrations/setup_storage_policies.sql`
5. Haz clic en **Run** (o presiona Cmd/Ctrl + Enter)
6. Verifica que aparezca "Success. No rows returned"

### Opción 2: Configuración Manual desde el Panel

Si prefieres configurar manualmente desde la interfaz:

1. Ve a **Storage** en el menú lateral
2. Selecciona el bucket `product-images`
3. Ve a la pestaña **Policies**
4. Asegúrate de tener estas políticas:

#### Política de Lectura Pública
- **Policy Name**: Public read access for product images
- **Allowed operation**: SELECT
- **Target roles**: public
- **USING expression**: `bucket_id = 'product-images'`

#### Política de Inserción para Autenticados
- **Policy Name**: Authenticated users can upload product images
- **Allowed operation**: INSERT
- **Target roles**: authenticated
- **WITH CHECK expression**: `bucket_id = 'product-images'`

#### Política de Actualización para Autenticados
- **Policy Name**: Authenticated users can update product images
- **Allowed operation**: UPDATE
- **Target roles**: authenticated
- **USING expression**: `bucket_id = 'product-images'`
- **WITH CHECK expression**: `bucket_id = 'product-images'`

#### Política de Eliminación para Autenticados
- **Policy Name**: Authenticated users can delete product images
- **Allowed operation**: DELETE
- **Target roles**: authenticated
- **USING expression**: `bucket_id = 'product-images'`

### Verificación

Después de configurar las políticas, verifica que funcionen:

1. Intenta subir una imagen desde el panel de administración de categorías
2. Deberías poder ver el preview y la imagen se debería subir correctamente
3. La URL debería guardarse automáticamente en el campo `image_url`

### Configuración del Bucket

Asegúrate también que el bucket esté configurado como **público**:

1. Ve a **Storage** → `product-images`
2. En la configuración del bucket, asegúrate que **Public bucket** esté activado
3. Esto permite que las imágenes sean accesibles sin autenticación

## ¿Qué hacen estas políticas?

- ✅ **Lectura pública**: Cualquiera puede ver las imágenes (necesario para mostrarlas en la web)
- ✅ **Subida autenticada**: Solo usuarios autenticados pueden subir imágenes
- ✅ **Actualización autenticada**: Solo usuarios autenticados pueden actualizar imágenes
- ✅ **Eliminación autenticada**: Solo usuarios autenticados pueden eliminar imágenes

## Troubleshooting

### Si sigues teniendo errores:

1. **Verifica que estés autenticado**: Asegúrate de haber iniciado sesión en `/login`
2. **Verifica el token**: Revisa que el token de autenticación se esté enviando correctamente
3. **Revisa los logs**: En Supabase Dashboard → Logs → Storage Logs
4. **Verifica las políticas**: Ejecuta en SQL Editor:
   ```sql
   SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
   ```

### Error común: "Bucket not found"

Si recibes este error, ejecuta:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;
```

## Seguridad

Estas políticas son seguras porque:
- ❌ Los visitantes anónimos NO pueden subir/modificar/eliminar archivos
- ✅ Los visitantes anónimos SÍ pueden VER las imágenes (necesario para el e-commerce)
- ✅ Solo usuarios autenticados (administradores) pueden gestionar archivos
- ✅ El bucket es público solo para lectura

## Próximos Pasos

Una vez configuradas las políticas, podrás:
1. Subir imágenes desde el panel de categorías
2. Subir imágenes desde el panel de productos (cuando lo implementemos)
3. Ver las imágenes públicamente en la web
4. Gestionar todo el almacenamiento desde la aplicación
