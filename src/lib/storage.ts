import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Configuración del almacenamiento de Supabase
 */

// URL base del bucket de imágenes de productos
export const PRODUCT_IMAGES_BUCKET = 'product-images';

/**
 * Obtiene la URL pública de un archivo en el bucket de product-images
 * @param path - Ruta del archivo dentro del bucket
 * @returns URL pública del archivo
 */
export function getProductImageUrl(path: string): string {
	if (!path) return '';
	
	// Remover slash inicial si existe
	const cleanPath = path.startsWith('/') ? path.slice(1) : path;
	
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${cleanPath}`;
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
	return url.includes(`/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`);
}
