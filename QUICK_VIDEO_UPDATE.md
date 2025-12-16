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
