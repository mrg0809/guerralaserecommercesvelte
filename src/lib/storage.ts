import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { HeroBannerSettings } from '$lib/heroBanner';

/**
 * Configuración del almacenamiento de Supabase
 */

// URL base del bucket de imágenes de productos
export const PRODUCT_IMAGES_BUCKET = 'product-images';
export const DESIGN_ICONS_BUCKET = 'design-icons';

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
 * URL pública de un icono SVG en el bucket design-icons
 */
export function getDesignIconUrl(path: string): string {
	if (!path) return '';
	const cleanPath = path.startsWith('/') ? path.slice(1) : path;
	if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
		return cleanPath;
	}
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${DESIGN_ICONS_BUCKET}/${cleanPath}`;
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

/** Añade transformaciones ImageKit a una URL ya convertida o convertible */
export function getImageKitUrlWithTransform(
	input: string | null | undefined,
	transform: string
): string {
	const ikUrl = getImageKitUrl(input);
	if (!ikUrl || !transform) return ikUrl;
	if (!ikUrl.includes('ik.imagekit.io')) return ikUrl;

	const separator = ikUrl.includes('?') ? '&' : '?';
	return `${ikUrl}${separator}${transform}`;
}

export const IMAGEKIT_TRANSFORMS = {
	heroLcp: 'tr=w-480,h-300,fo-auto,q-75,f-auto',
	heroMobile: 'tr=w-800,h-500,fo-auto,q-80,f-auto',
	heroMobileVideo: 'tr=w-480,q-60',
	heroDesktopImage: 'tr=w-1920,h-500,fo-auto,q-80,f-auto',
	promotion: 'tr=w-400,q-75,f-auto',
	category: 'tr=w-500,h-384,fo-auto,q-75,f-auto',
	featuredProduct: 'tr=w-600,h-512,fo-auto,q-80,f-auto',
	logo: 'tr=w-200,q-80,f-auto'
} as const;

/** Logo local servido desde /static cuando ImageKit no está disponible */
export const SITE_LOGO_FALLBACK_URL = '/logorectangular.png';

/** Logo del sitio optimizado vía ImageKit */
export function getSiteLogoUrl(): string {
	return `${IMAGEKIT_BASE_URL}/logorectangular.png?${IMAGEKIT_TRANSFORMS.logo}`;
}

/** URL de video o imagen desktop del hero vía ImageKit (sin transform en videos) */
export function getHeroDesktopMediaUrl(path: string, mediaType: 'video' | 'image'): string {
	const ikUrl = getImageKitUrl(path);
	if (mediaType === 'image') {
		return getImageKitUrlWithTransform(path, IMAGEKIT_TRANSFORMS.heroDesktopImage);
	}
	return ikUrl;
}

/** URL de video móvil del hero comprimido para móvil */
export function getHeroMobileVideoUrl(path: string): string {
	return getImageKitUrlWithTransform(path, IMAGEKIT_TRANSFORMS.heroMobileVideo);
}

/** Poster/thumbnail del video móvil para LCP */
export function getHeroMobileVideoPosterUrl(path: string): string {
	const videoUrl = getImageKitUrl(path);
	if (!videoUrl.includes('ik.imagekit.io')) return '';
	return getImageKitUrlWithTransform(`${videoUrl}/ik-thumbnail.jpg`, IMAGEKIT_TRANSFORMS.heroMobile);
}

/** URL de imagen móvil del hero optimizada para LCP */
export function getHeroMobileImageUrl(path: string, desktopVideoPath?: string): string {
	if (path) {
		return getImageKitUrlWithTransform(path, IMAGEKIT_TRANSFORMS.heroMobile);
	}

	// Fallback: miniatura del video desktop vía ImageKit
	if (desktopVideoPath) {
		const videoUrl = getImageKitUrl(desktopVideoPath);
		if (videoUrl.includes('ik.imagekit.io')) {
			return getImageKitUrlWithTransform(
				`${videoUrl}/ik-thumbnail.jpg`,
				IMAGEKIT_TRANSFORMS.heroMobile
			);
		}
	}

	return '';
}

/** URL optimizada del candidato LCP móvil (hero) */
export function getHeroLcpImageUrl(config: HeroBannerSettings): string {
	const mobilePath =
		config.mobile_url || (config.media_type === 'image' ? config.desktop_url : '');

	if (config.mobile_media_type === 'image') {
		if (mobilePath) {
			return getImageKitUrlWithTransform(mobilePath, IMAGEKIT_TRANSFORMS.heroLcp);
		}

		if (config.desktop_url && config.media_type === 'video') {
			const videoUrl = getImageKitUrl(config.desktop_url);
			if (videoUrl.includes('ik.imagekit.io')) {
				return getImageKitUrlWithTransform(
					`${videoUrl}/ik-thumbnail.jpg`,
					IMAGEKIT_TRANSFORMS.heroLcp
				);
			}
		}

		return '';
	}

	if (config.mobile_poster_url) {
		return getImageKitUrlWithTransform(config.mobile_poster_url, IMAGEKIT_TRANSFORMS.heroLcp);
	}

	if (mobilePath) {
		const videoUrl = getImageKitUrl(mobilePath);
		if (videoUrl.includes('ik.imagekit.io')) {
			return getImageKitUrlWithTransform(
				`${videoUrl}/ik-thumbnail.jpg`,
				IMAGEKIT_TRANSFORMS.heroLcp
			);
		}
	}

	if (config.desktop_url && config.media_type === 'video') {
		const videoUrl = getImageKitUrl(config.desktop_url);
		if (videoUrl.includes('ik.imagekit.io')) {
			return getImageKitUrlWithTransform(
				`${videoUrl}/ik-thumbnail.jpg`,
				IMAGEKIT_TRANSFORMS.heroLcp
			);
		}
	}

	return '';
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
