# Imágenes y Almacenamiento de Productos

Configuración del bucket Supabase, políticas RLS y gestión de imágenes en el admin.

## Tabla de contenidos

1. [Bucket y funciones auxiliares](#bucket-y-funciones-auxiliares)
2. [Políticas de almacenamiento (RLS)](#políticas-de-almacenamiento-rls)
3. [Gestión de imágenes en productos](#gestión-de-imágenes-en-productos)

---

# Guía de Uso del Bucket de Product Images

## Configuración

El bucket `product-images` en Supabase está configurado para almacenar todas las imágenes y videos relacionados con los productos.

### URL del Bucket
```
https://ugxuhfmjxvhglswxspiv.supabase.co/storage/v1/object/public/product-images/
```

## Archivos en el Bucket

### Video del Banner
- **Archivo**: `bannerpagina.mp4`
- **Ubicación**: Raíz del bucket
- **Uso**: Banner principal de la página de inicio
- **URL completa**: `https://ugxuhfmjxvhglswxspiv.supabase.co/storage/v1/object/public/product-images/bannerpagina.mp4`

## Funciones Auxiliares

Se ha creado el archivo `src/lib/storage.ts` con funciones útiles para trabajar con el bucket:

### `getProductImageUrl(path: string): string`
Obtiene la URL pública de un archivo en el bucket.

**Ejemplo:**
```typescript
import { getProductImageUrl } from '$lib/storage';

const imageUrl = getProductImageUrl('products/laser-machine.jpg');
// Resultado: https://ugxuhfmjxvhglswxspiv.supabase.co/storage/v1/object/public/product-images/products/laser-machine.jpg
```

### `getBannerVideoUrl(): string`
Obtiene la URL del video del banner.

**Ejemplo:**
```typescript
import { getBannerVideoUrl } from '$lib/storage';

const videoUrl = getBannerVideoUrl();
// Resultado: https://ugxuhfmjxvhglswxspiv.supabase.co/storage/v1/object/public/product-images/bannerpagina.mp4
```

### `isProductImageUrl(url: string): boolean`
Valida si una URL pertenece al bucket de product-images.

**Ejemplo:**
```typescript
import { isProductImageUrl } from '$lib/storage';

const isValid = isProductImageUrl('https://ugxuhfmjxvhglswxspiv.supabase.co/storage/v1/object/public/product-images/test.jpg');
// Resultado: true
```

## Organización Sugerida del Bucket

```
product-images/
├── bannerpagina.mp4          # Video del banner principal
├── categories/               # Imágenes de categorías (subidas desde admin)
│   ├── maquinaria-123456.jpg
│   ├── refacciones-789012.jpg
│   └── ...
├── products/                 # Imágenes de productos
│   ├── laser-machine-1.jpg
│   ├── laser-machine-2.jpg
│   └── ...
└── accessories/              # Imágenes de accesorios
    └── ...
```

## Subir Archivos al Bucket

### Desde el Panel de Administración (Recomendado)

#### Para Categorías
1. Ve a la sección de Administración → Categorías
2. Haz clic en "Nueva Categoría" o "Editar" en una existente
3. En el formulario, busca la sección "Imagen de Categoría"
4. Haz clic en "Seleccionar archivo" y elige una imagen
5. La imagen se subirá automáticamente al bucket en `categories/` cuando guardes
6. El sistema genera automáticamente un nombre único y guarda la URL

**Características:**
- ✅ Subida automática al bucket
- ✅ Validación de tipo de archivo (JPG, PNG, WEBP, GIF)
- ✅ Límite de tamaño: 5MB
- ✅ Preview en tiempo real
- ✅ URL generada automáticamente

#### Para Productos
1. Ve a la sección de Administración → Productos
2. Haz clic en "Nuevo Producto" o "Editar" en uno existente
3. En el formulario, busca la sección "Imágenes del Producto"
4. Haz clic en "Seleccionar archivo" y elige una o varias imágenes
5. Las imágenes se subirán automáticamente al bucket en `products/` cuando guardes
6. Puedes agregar múltiples imágenes al mismo producto

**Características:**
- ✅ Soporte para múltiples imágenes por producto
- ✅ Subida automática al bucket
- ✅ Validación de tipo de archivo (JPG, PNG, WEBP, GIF)
- ✅ Límite de tamaño: 5MB por imagen
- ✅ Preview en tiempo real de todas las imágenes
- ✅ La primera imagen es automáticamente la principal
- ✅ Puedes cambiar la imagen principal con un clic
- ✅ Eliminar imágenes individualmente
- ✅ URLs generadas automáticamente

### Desde el Panel de Supabase
1. Ve a Storage en el panel de Supabase
2. Selecciona el bucket `product-images`
3. Haz clic en "Upload file"
4. Selecciona el archivo y súbelo

### Desde el Código (para administración)
```typescript
import { supabase } from '$lib/supabaseClient';

// Subir una imagen
async function uploadProductImage(file: File, path: string) {
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error uploading file:', error);
    return null;
  }

  // Obtener la URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(path);

  return publicUrl;
}
```

## Políticas de Seguridad

El bucket `product-images` está configurado como **público**, lo que significa que:
- ✅ Cualquier usuario puede **leer** los archivos
- ❌ Solo usuarios autenticados/autorizados pueden **subir** archivos
- ❌ Solo usuarios autenticados/autorizados pueden **eliminar** archivos

## Uso en la Aplicación

### En la Página de Inicio
El video del banner se muestra automáticamente usando la función `getBannerVideoUrl()`:

```svelte
<script lang="ts">
  import { getBannerVideoUrl } from '$lib/storage';
  
  const bannerVideoUrl = getBannerVideoUrl();
</script>

<video autoplay loop muted playsinline>
  <source src={bannerVideoUrl} type="video/mp4" />
</video>
```

### Para Imágenes de Productos
```svelte
<script lang="ts">
  import { getProductImageUrl } from '$lib/storage';
  
  const productImage = getProductImageUrl('products/laser-machine.jpg');
</script>

<img src={productImage} alt="Máquina Láser" />
```

## Mantenimiento

- **Limpieza periódica**: Elimina imágenes que ya no se usen
- **Optimización**: Comprime imágenes antes de subirlas para mejorar el rendimiento
- **Nomenclatura**: Usa nombres descriptivos y consistentes para los archivos
- **Organización**: Mantén la estructura de carpetas organizada

## Notas Importantes

1. El video del banner (`bannerpagina.mp4`) debe estar en la raíz del bucket
2. Todas las URLs generadas son públicas y accesibles sin autenticación
3. Para cambiar el video del banner, simplemente reemplaza el archivo `bannerpagina.mp4` en el bucket
4. Las funciones de storage están disponibles globalmente a través de `$lib/storage` o `$lib`


---


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


---


# Implementación de Gestión de Imágenes para Productos

## ✅ Cambios Realizados

Se ha implementado un sistema completo de gestión de imágenes para productos, permitiendo subir múltiples imágenes directamente al bucket de `product-images`.

### 1. Nuevas Funcionalidades

#### 📤 Subida de Múltiples Imágenes
- Permite seleccionar y subir múltiples imágenes a la vez
- Cada imagen se almacena en `product-images/products/`
- Nombres únicos generados automáticamente
- Validación de tipo y tamaño de archivo

#### 🖼️ Gestión de Imágenes
- **Ver imágenes existentes**: Muestra todas las imágenes del producto
- **Agregar nuevas imágenes**: Sube más imágenes a productos existentes
- **Eliminar imágenes**: Elimina imágenes individuales del producto
- **Imagen principal**: La primera imagen es automáticamente la principal
- **Cambiar imagen principal**: Clic en "Hacer Principal" para cambiar

#### 🎨 Preview en Tiempo Real
- Vista previa de imágenes existentes
- Vista previa de nuevas imágenes antes de guardar
- Indicadores visuales (Principal, Nueva)
- Hover effects para acciones

### 2. Funciones Implementadas

```typescript
// Cargar imágenes del producto
loadProductImages(productId: string)

// Manejar selección de archivos
handleImageSelect(event: Event)

// Subir imágenes al bucket
uploadProductImages(productId: string)

// Eliminar imagen
removeProductImage(imageId: string, imageUrl: string)

// Establecer imagen principal
setPrimaryImage(imageId: string)

// Remover imagen del preview
removePreviewImage(index: number)
```

### 3. Interfaz de Usuario

#### Para Productos Nuevos
```
┌─────────────────────────────────────┐
│ Imágenes del Producto               │
├─────────────────────────────────────┤
│ [Área de selección de archivos]    │
│ Arrastra o selecciona múltiples     │
│ imágenes (JPG, PNG, WEBP, GIF)      │
│                                     │
│ ⚠️ La primera imagen será principal │
└─────────────────────────────────────┘
```

#### Para Productos Existentes
```
┌─────────────────────────────────────┐
│ Imágenes del Producto               │
├─────────────────────────────────────┤
│ Imágenes actuales:                  │
│ ┌────┐ ┌────┐ ┌────┐               │
│ │IMG1│ │IMG2│ │IMG3│               │
│ │ P  │ │ H  │ │ X  │               │
│ └────┘ └────┘ └────┘               │
│                                     │
│ Nuevas imágenes a subir:            │
│ ┌────┐ ┌────┐                      │
│ │NEW1│ │NEW2│                      │
│ │ X  │ │ X  │                      │
│ └────┘ └────┘                      │
│                                     │
│ [+ Agregar más imágenes]            │
└─────────────────────────────────────┘

Leyenda:
P = Principal
H = Hacer Principal (hover)
X = Eliminar
```

### 4. Validaciones Implementadas

- ✅ Tipo de archivo: JPG, PNG, WEBP, GIF
- ✅ Tamaño máximo: 5MB por imagen
- ✅ Múltiples archivos permitidos
- ✅ Nombres únicos generados automáticamente
- ✅ Verificación antes de eliminar

### 5. Flujo de Trabajo

#### Crear Producto con Imágenes
1. Llenar formulario del producto
2. Seleccionar una o más imágenes
3. Ver preview de las imágenes
4. Guardar producto
5. Las imágenes se suben automáticamente
6. Se guardan en `product_media`

#### Agregar Imágenes a Producto Existente
1. Editar producto
2. Ver imágenes actuales
3. Seleccionar nuevas imágenes
4. Ver preview de nuevas imágenes
5. Guardar
6. Nuevas imágenes se agregan a las existentes

#### Gestionar Imágenes
1. Editar producto
2. Ver todas las imágenes
3. Hacer clic en "Hacer Principal" para cambiar imagen principal
4. Hacer clic en "×" para eliminar imagen
5. Cambios se guardan automáticamente

### 6. Estructura de Datos

#### Tabla: `product_media`
```sql
{
  id: uuid,
  product_id: uuid (FK),
  url: text,
  media_type: text ('image'),
  is_primary: boolean,
  display_order: integer,
  created_at: timestamp
}
```

### 7. Almacenamiento en Bucket

#### Nomenclatura de Archivos
```
products/{slug}-{timestamp}-{random}.{ext}
```

**Ejemplo:**
```
products/maquina-laser-co2-1702598400000-a7b3c9d.jpg
```

#### Ventajas
- ✅ Nombres únicos (evita conflictos)
- ✅ Fácil de identificar (incluye slug)
- ✅ Ordenado cronológicamente (timestamp)
- ✅ Organizado por tipo (carpeta products/)

### 8. Características de Seguridad

- ❌ Usuarios anónimos NO pueden subir imágenes
- ✅ Solo usuarios autenticados pueden gestionar imágenes
- ✅ Validación en el cliente (tipo y tamaño)
- ✅ Las políticas RLS protegen el bucket
- ✅ Eliminación segura de archivos

### 9. Mejoras de UX

- 🎯 **Drag & Drop** estilizado para selección de archivos
- 👁️ **Preview instantáneo** de todas las imágenes
- 🏷️ **Etiquetas visuales** (Principal, Nueva)
- 🎨 **Hover effects** para acciones
- 🔄 **Estado de carga** visible
- ⚠️ **Mensajes claros** de validación
- 🚫 **Botones deshabilitados** durante carga

### 10. Integración con el Sistema

#### Se integra con:
- ✅ Sistema de productos existente
- ✅ Categorías y jerarquías
- ✅ Descuentos y etiquetas
- ✅ Especificaciones de producto
- ✅ Storage de Supabase
- ✅ Base de datos de Supabase

### 11. Archivos Modificados

```
src/routes/admin/productos/+page.svelte
  ├── Nuevas importaciones (getProductImageUrl, ProductMedia)
  ├── Variables de estado para imágenes
  ├── Funciones de gestión de imágenes
  ├── UI para subir/gestionar imágenes
  └── Integración con saveProduct()

STORAGE_GUIDE.md
  └── Documentación de productos

PRODUCT_IMAGES_GUIDE.md (nuevo)
  └── Guía completa de uso
```

### 12. Próximos Pasos (Opcional)

Mejoras futuras que podrías considerar:

1. **Reordenar imágenes**: Drag & drop para cambiar el orden
2. **Edición de imágenes**: Recorte, rotación, filtros
3. **Optimización automática**: Compresión de imágenes
4. **Múltiples tamaños**: Thumbnails automáticos
5. **Alt text**: Texto alternativo para SEO
6. **Lazy loading**: Carga diferida de imágenes

### 13. Uso Básico

#### Crear producto con imágenes:
1. Clic en "Nuevo Producto"
2. Completar datos del producto
3. Scroll hasta "Imágenes del Producto"
4. Clic en el área de carga o arrastra archivos
5. Selecciona 1 o más imágenes
6. Ve el preview
7. Clic en "Crear Producto"
8. ¡Listo! 🎉

#### Gestionar imágenes:
1. Editar producto existente
2. Scroll hasta "Imágenes del Producto"
3. Para cambiar principal: clic en "Hacer Principal"
4. Para eliminar: clic en "×"
5. Para agregar más: selecciona nuevas imágenes
6. Clic en "Actualizar Producto"

## 🎉 ¡Todo Listo!

El sistema de imágenes para productos está completamente funcional y listo para usar. Puedes empezar a agregar productos con múltiples imágenes de inmediato.
