# Carrusel de Videos de Testimonios

Guía completa y referencia rápida para actualizar videos en la página de inicio.

## Tabla de contenidos

1. [Guía de uso del carrusel](#guía-de-uso-del-carrusel)
2. [Actualización rápida de videos](#actualización-rápida-de-videos)

---

# Guía de Uso del Carrusel de Videos de Testimonios

## 📹 Descripción

Se ha implementado un carrusel interactivo de videos para mostrar testimonios de clientes satisfechos. El carrusel soporta videos de **YouTube** y **TikTok**.

## 🎨 Características

### Visuales
- ✅ Diseño moderno y atractivo con gradientes
- ✅ Carrusel automático cada 5 segundos
- ✅ Navegación con flechas laterales
- ✅ Navegación con puntos (dots)
- ✅ Miniaturas clickeables (solo desktop)
- ✅ Animaciones suaves de transición
- ✅ Totalmente responsive

### Funcionales
- ✅ Soporte para YouTube
- ✅ Soporte para TikTok
- ✅ Autoplay pausable al hacer clic
- ✅ Videos embebidos (iframe)
- ✅ Indicador visual del video activo

## 📝 Cómo Agregar Videos

### Paso 1: Obtener la URL del Video

#### Para YouTube:
1. Ve al video en YouTube
2. Haz clic en "Compartir"
3. Haz clic en "Insertar"
4. Copia la URL del `src` del iframe
5. Ejemplo: `https://www.youtube.com/embed/dQw4w9WgXcQ`

#### Para TikTok:
1. Ve al video en TikTok
2. Haz clic en los tres puntos (...)
3. Selecciona "Insertar"
4. Copia la URL del iframe
5. Ejemplo: `https://www.tiktok.com/embed/v2/VIDEO_ID`

### Paso 2: Obtener el Thumbnail (solo YouTube)

Para YouTube, el thumbnail se genera automáticamente con esta URL:
```
https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg
```

Donde `VIDEO_ID` es el ID del video (la parte después de `embed/`)

### Paso 3: Editar el Archivo

Abre `src/routes/+page.svelte` y busca la sección `testimonialVideos`:

```typescript
const testimonialVideos = [
	{
		id: 1,
		type: 'youtube', // 'youtube' o 'tiktok'
		url: 'https://www.youtube.com/embed/TU_VIDEO_ID',
		title: 'Descripción del testimonio',
		thumbnail: 'https://img.youtube.com/vi/TU_VIDEO_ID/maxresdefault.jpg'
	},
	// Agrega más videos aquí...
];
```

## 📋 Ejemplos de Configuración

### Ejemplo 1: Video de YouTube
```typescript
{
	id: 1,
	type: 'youtube',
	url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
	title: 'Cliente satisfecho - Máquina Láser CO2',
	thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
}
```

### Ejemplo 2: Video de TikTok
```typescript
{
	id: 2,
	type: 'tiktok',
	url: 'https://www.tiktok.com/embed/v2/7234567890123456789',
	title: 'Resultados increíbles con Router CNC',
	thumbnail: '' // TikTok genera su propio preview
}
```

### Ejemplo 3: Múltiples Videos
```typescript
const testimonialVideos = [
	{
		id: 1,
		type: 'youtube',
		url: 'https://www.youtube.com/embed/VIDEO_ID_1',
		title: 'Máquina Láser CO2 - Testimonio',
		thumbnail: 'https://img.youtube.com/vi/VIDEO_ID_1/maxresdefault.jpg'
	},
	{
		id: 2,
		type: 'youtube',
		url: 'https://www.youtube.com/embed/VIDEO_ID_2',
		title: 'Fibra Óptica - Cliente Satisfecho',
		thumbnail: 'https://img.youtube.com/vi/VIDEO_ID_2/maxresdefault.jpg'
	},
	{
		id: 3,
		type: 'tiktok',
		url: 'https://www.tiktok.com/embed/v2/VIDEO_ID_3',
		title: 'Router CNC en Acción',
		thumbnail: ''
	},
	{
		id: 4,
		type: 'youtube',
		url: 'https://www.youtube.com/embed/VIDEO_ID_4',
		title: 'Plasma - Resultados Profesionales',
		thumbnail: 'https://img.youtube.com/vi/VIDEO_ID_4/maxresdefault.jpg'
	}
];
```

## 🎯 Configuración Avanzada

### Cambiar el Tiempo de Autoplay

Por defecto, el carrusel cambia de video cada 5 segundos. Para modificarlo:

```typescript
function startVideoCarousel() {
	// Cambiar 5000 (5 segundos) al tiempo deseado en milisegundos
	autoplayInterval = setInterval(() => {
		nextVideo();
	}, 5000); // <-- Modifica este valor
}
```

### Desactivar Autoplay

Si prefieres que el carrusel no cambie automáticamente:

```typescript
onMount(async () => {
	// ... código existente ...
	
	// Comenta o elimina esta línea:
	// startVideoCarousel();
	
	// ... resto del código ...
});
```

### Cambiar Enlaces de Redes Sociales

En la sección "Social Proof" al final del carrusel:

```svelte
<a 
	href="https://www.youtube.com/@TU_CANAL_AQUI"  <!-- Cambia esto -->
	target="_blank"
	rel="noopener noreferrer"
	class="..."
>
	YouTube
</a>

<a 
	href="https://www.tiktok.com/@TU_USUARIO_AQUI"  <!-- Cambia esto -->
	target="_blank"
	rel="noopener noreferrer"
	class="..."
>
	TikTok
</a>
```

## 🎨 Personalización de Estilos

### Cambiar Colores

Los colores principales están definidos con clases de Tailwind:

```svelte
<!-- Gradiente de fondo -->
<section class="py-16 bg-gradient-to-br from-blue-50 to-indigo-50">

<!-- Título del video -->
<div class="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">

<!-- Botones de navegación hover -->
<button class="... hover:bg-blue-600 ...">
```

Para cambiar el esquema de color, reemplaza `blue` e `indigo` con otros colores de Tailwind como `purple`, `red`, `green`, etc.

### Modificar el Tamaño

El contenedor tiene un ancho máximo definido:

```svelte
<div class="relative max-w-5xl mx-auto">
```

Cambia `max-w-5xl` a:
- `max-w-4xl` (más pequeño)
- `max-w-6xl` (más grande)
- `max-w-7xl` (muy grande)

## 📱 Comportamiento Responsive

- **Desktop (>1024px)**: Muestra miniaturas de 4 videos
- **Tablet (768px-1024px)**: Oculta miniaturas, muestra dots y flechas
- **Mobile (<768px)**: Flechas más compactas, solo dots de navegación

## 🔧 Solución de Problemas

### Video no se muestra
1. Verifica que la URL sea correcta
2. Asegúrate de usar la URL de **embed**, no la URL normal
3. Para YouTube: Debe ser `youtube.com/embed/VIDEO_ID`
4. Para TikTok: Debe ser `tiktok.com/embed/v2/VIDEO_ID`

### Thumbnail no aparece
1. Verifica que el `VIDEO_ID` sea correcto
2. Intenta con diferentes calidades:
   - `maxresdefault.jpg` (mejor calidad)
   - `hqdefault.jpg` (alta calidad)
   - `mqdefault.jpg` (media calidad)
   - `default.jpg` (básica)

### El carrusel no avanza automáticamente
1. Verifica que `startVideoCarousel()` se esté llamando en `onMount`
2. Revisa la consola del navegador por errores

## 💡 Mejores Prácticas

1. **Títulos descriptivos**: Usa títulos que describan claramente el testimonio
2. **Variedad**: Mezcla videos de YouTube y TikTok para variedad
3. **Calidad**: Asegúrate de que los videos tengan buena calidad
4. **Duración**: Videos de 30-90 segundos son ideales
5. **Cantidad**: 4-6 videos es un buen balance
6. **Actualización**: Mantén los videos actualizados con nuevos testimonios

## 🎬 Consejos para Grabar Testimonios

1. **Iluminación**: Buena luz natural o artificial
2. **Audio**: Micrófono decente o ambiente silencioso
3. **Contenido**: Enfócate en resultados y beneficios
4. **Autenticidad**: Testimonios reales y honestos
5. **Variedad**: Diferentes tipos de máquinas y aplicaciones

## 📊 Métricas de Éxito

Considera rastrear:
- Clics en los videos
- Tiempo de visualización
- Videos más populares
- Conversiones desde la sección de testimonios

## 🚀 Próximas Mejoras (Opcional)

Ideas para futuras mejoras:

1. **Contador de vistas**: Mostrar cuántas veces se ha visto cada video
2. **Sistema de valoración**: Permitir que usuarios valoren los videos
3. **Filtros**: Filtrar por tipo de máquina
4. **Modo teatro**: Ver video en pantalla completa
5. **Compartir**: Botones para compartir testimonios
6. **Comentarios**: Sección de comentarios por video
7. **Carga desde BD**: Administrar videos desde el panel admin

## 📞 Soporte

Si necesitas ayuda para configurar los videos, revisa:
- La documentación de YouTube Embed
- La documentación de TikTok Embed
- Los ejemplos en este archivo


---


# Instrucciones Rápidas para Actualizar Videos

## 🎯 Pasos Simples

### 1. Abre el archivo principal
```
src/routes/+page.svelte
```

### 2. Busca la sección `testimonialVideos`

Aproximadamente en la línea 15-40, encontrarás algo como esto:

```typescript
const testimonialVideos = [
	{
		id: 1,
		type: 'youtube',
		url: 'https://www.youtube.com/embed/VIDEO_ID_1',
		title: 'Cliente satisfecho - Máquina Láser CO2',
		thumbnail: 'https://img.youtube.com/vi/VIDEO_ID_1/maxresdefault.jpg'
	},
	// ... más videos
];
```

### 3. Reemplaza con tus videos

#### Ejemplo con videos reales de YouTube:

```typescript
const testimonialVideos = [
	{
		id: 1,
		type: 'youtube',
		url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
		title: 'Máquina Láser CO2 - Resultados Increíbles',
		thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
	},
	{
		id: 2,
		type: 'youtube',
		url: 'https://www.youtube.com/embed/9bZkp7q19f0',
		title: 'Fibra Óptica - Cliente Satisfecho',
		thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/maxresdefault.jpg'
	},
	{
		id: 3,
		type: 'youtube',
		url: 'https://www.youtube.com/embed/jNQXAC9IVRw',
		title: 'Router CNC en Acción',
		thumbnail: 'https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg'
	},
	{
		id: 4,
		type: 'youtube',
		url: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
		title: 'Plasma - Corte Profesional',
		thumbnail: 'https://img.youtube.com/vi/kJQP7kiw5Fk/maxresdefault.jpg'
	}
];
```

## 🔍 Cómo Obtener el ID de un Video de YouTube

### Método 1: Desde la URL del video
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
                                 ^^^^^^^^^^^
                                 Este es el ID
```

### Método 2: Desde el botón Compartir
1. Haz clic en "Compartir" bajo el video
2. Haz clic en "Insertar"
3. Verás algo como:
   ```html
   <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
   ```
4. Copia la URL completa del `src`

## 📝 Template para Copiar y Pegar

Copia esto y reemplaza los valores:

```typescript
{
	id: 1,                                    // Número único (1, 2, 3, 4...)
	type: 'youtube',                          // Siempre 'youtube' o 'tiktok'
	url: 'https://www.youtube.com/embed/TU_VIDEO_ID_AQUI',
	title: 'Descripción corta del testimonio',
	thumbnail: 'https://img.youtube.com/vi/TU_VIDEO_ID_AQUI/maxresdefault.jpg'
}
```

## 🎬 Para TikTok

```typescript
{
	id: 5,
	type: 'tiktok',
	url: 'https://www.tiktok.com/embed/v2/TU_VIDEO_ID_AQUI',
	title: 'Descripción del video de TikTok',
	thumbnail: ''  // Dejar vacío para TikTok
}
```

## ✅ Checklist Antes de Guardar

- [ ] Cada video tiene un `id` único
- [ ] Las URLs de YouTube tienen `/embed/` en lugar de `/watch?v=`
- [ ] Los thumbnails tienen el mismo VIDEO_ID que la URL
- [ ] Los títulos son descriptivos
- [ ] El último video NO tiene coma al final
- [ ] Todos los videos excepto el último tienen coma

## 🚀 Después de Editar

1. Guarda el archivo
2. El navegador debería recargar automáticamente
3. Verifica que los videos se muestren correctamente
4. Prueba la navegación con las flechas y los puntos

## 🆘 Si Algo Sale Mal

### El video no se muestra
- Verifica que la URL tenga `/embed/` 
- Asegúrate de que el video sea público

### El thumbnail no aparece
- Cambia `maxresdefault.jpg` por `hqdefault.jpg`
- Verifica que el VIDEO_ID sea correcto

### Error en la consola
- Revisa que no falten comas entre videos
- Verifica que todos los corchetes `[]` y llaves `{}` estén cerrados
- Asegúrate de que el último video NO tenga coma

## 📞 Necesitas Ayuda?

Revisa los archivos:
- `VIDEO_CAROUSEL_GUIDE.md` - Guía completa
- Esta guía - Instrucciones rápidas

---

**¡Listo para agregar tus videos de clientes satisfechos! 🎉**
