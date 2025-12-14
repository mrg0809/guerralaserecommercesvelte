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
