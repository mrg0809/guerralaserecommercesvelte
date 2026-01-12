import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Configuración del almacenamiento de Supabase
 */

// URL base del bucket de imágenes de productos
export const PRODUCT_IMAGES_BUCKET = 'product-images';

// Configuración básica de ImageKit
// ID proporcionado: oljeu5ae7y
export const IMAGEKIT_ID = 'oljeu5ae7y';
export const IMAGEKIT_BASE_URL = `https://ik.imagekit.io/${IMAGEKIT_ID}`;

/**
 * Obtiene la URL pública directa en Supabase (origen)
 * @param path - Ruta del archivo dentro del bucket
 * @returns URL pública del archivo en Supabase
 */
export function getProductImageUrl(path: string): string {
	if (!path) return '';

	// Remover slash inicial si existe
	const cleanPath = path.startsWith('/') ? path.slice(1) : path;

	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${cleanPath}`;
}

/**
 * Convierte una URL de Supabase (bucket product-images) o un path de archivo
 * a la URL correspondiente en ImageKit.
 *
 * Ejemplos:
 *  - https://xyz.supabase.co/storage/v1/object/public/product-images/foto.jpg
 *    -> https://ik.imagekit.io/oljeu5ae7y/foto.jpg
 *  - products/mi-foto.jpg -> https://ik.imagekit.io/oljeu5ae7y/products/mi-foto.jpg
 *
 * Si la URL ya es de ImageKit, se devuelve tal cual.
 * Si es una URL http que no pertenece al bucket configurado, se devuelve tal cual.
 */
export function getImageKitUrl(input: string | null | undefined): string {
	if (!input) return '';

	const url = String(input);

	// Ya es una URL de ImageKit
	if (url.includes('ik.imagekit.io')) {
		return url;
	}

	const bucketMarker = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
	const markerIndex = url.indexOf(bucketMarker);

	let path: string | null = null;

	if (markerIndex !== -1) {
		// URL pública completa de Supabase para este bucket
		path = url.substring(markerIndex + bucketMarker.length);
	} else if (!url.startsWith('http://') && !url.startsWith('https://')) {
		// Es solo un path relativo dentro del bucket
		path = url;
	} else {
		// Es una URL http que no coincide con nuestro bucket: la dejamos tal cual
		return url;
	}

	const cleanPath = path.startsWith('/') ? path.slice(1) : path;
	return `${IMAGEKIT_BASE_URL}/${cleanPath}`;
}

/**
 * Obtiene la URL del video del banner
 * @returns URL del video del banner
 */
export function getBannerVideoUrl(): string {
	return getProductImageUrl('bannerpagina.mp4');
}

/**
 * Valida si una URL es una imagen válida del bucket
 * @param url - URL a validar
 * @returns true si la URL es del bucket de product-images
 */
export function isProductImageUrl(url: string): boolean {
	return (
		url.includes(`/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`) ||
		url.includes(IMAGEKIT_BASE_URL)
	);
}
