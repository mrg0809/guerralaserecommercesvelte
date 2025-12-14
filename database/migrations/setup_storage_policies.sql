-- Configuración de políticas de seguridad para el bucket product-images
-- Este archivo configura las políticas RLS (Row Level Security) para permitir
-- operaciones en el bucket de almacenamiento

-- ============================================================================
-- PASO 1: Asegurar que el bucket existe y es público
-- ============================================================================

-- Crear el bucket si no existe (public = true para permitir acceso de lectura público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================================
-- PASO 2: Eliminar políticas existentes (si las hay)
-- ============================================================================

DROP POLICY IF EXISTS "Public read access for product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- ============================================================================
-- PASO 3: Crear políticas para LECTURA pública
-- ============================================================================

-- Cualquiera puede VER/LEER las imágenes (público)
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- ============================================================================
-- PASO 4: Crear políticas para usuarios AUTENTICADOS
-- ============================================================================

-- Los usuarios autenticados pueden SUBIR archivos
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Los usuarios autenticados pueden ACTUALIZAR sus archivos
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- Los usuarios autenticados pueden ELIMINAR archivos
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Para verificar que las políticas se crearon correctamente, ejecuta:
-- SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
