export type HeroBannerMediaType = 'video' | 'image';
export type HeroBannerMobileMediaType = 'image' | 'video';

export const HERO_BANNER_SETTINGS_KEY = 'hero_banner';

export const MOBILE_VIDEO_MAX_BYTES = 8 * 1024 * 1024;

export interface HeroBannerSettings {
	media_type: HeroBannerMediaType;
	desktop_url: string;
	mobile_media_type: HeroBannerMobileMediaType;
	mobile_url: string;
	/** JPEG/WebP dedicado para LCP cuando el media móvil es video */
	mobile_poster_url: string;
	title: string;
	subtitle: string;
	show_overlay_text: boolean;
}

export const DEFAULT_HERO_BANNER: HeroBannerSettings = {
	media_type: 'video',
	desktop_url: 'bannerpagina.mp4',
	mobile_media_type: 'image',
	mobile_url: '',
	mobile_poster_url: '',
	title: 'ESPECIALISTAS EN VENTA DE MAQUINARIA',
	subtitle: 'En corte de metales, corte laser co2, fibra óptica, plasma, router, etc.',
	show_overlay_text: true
};

export function isVideoMediaUrl(url: string): boolean {
	return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export function validateHeroBanner(settings: HeroBannerSettings): string | null {
	if (!settings.desktop_url) {
		return 'Debes configurar el media de escritorio';
	}

	if (settings.media_type === 'video' && !settings.mobile_url) {
		return 'Cuando el banner de escritorio es video, debes subir una imagen o video ligero para móvil';
	}

	if (settings.mobile_media_type === 'video' && settings.mobile_url && !isVideoMediaUrl(settings.mobile_url)) {
		return 'El media móvil está configurado como video pero la URL no parece ser un video';
	}

	if (settings.mobile_media_type === 'image' && settings.mobile_url && isVideoMediaUrl(settings.mobile_url)) {
		return 'El media móvil está configurado como imagen pero la URL parece ser un video';
	}

	if (settings.show_overlay_text && !settings.title) {
		return 'El título del banner es obligatorio cuando se muestra el texto encima';
	}

	return null;
}

export function parseHeroBanner(raw: string | null | undefined): HeroBannerSettings {
	if (!raw?.trim()) return { ...DEFAULT_HERO_BANNER };

	try {
		const parsed = JSON.parse(raw) as Partial<HeroBannerSettings> & { mobile_image_url?: string };
		const mediaType = parsed.media_type === 'image' ? 'image' : 'video';
		const mobileUrl = String(parsed.mobile_url || parsed.mobile_image_url || '').trim();
		let mobileMediaType: HeroBannerMobileMediaType =
			parsed.mobile_media_type === 'video' ? 'video' : 'image';

		if (!parsed.mobile_media_type && mobileUrl && isVideoMediaUrl(mobileUrl)) {
			mobileMediaType = 'video';
		}

		return {
			media_type: mediaType,
			desktop_url: String(parsed.desktop_url || DEFAULT_HERO_BANNER.desktop_url).trim(),
			mobile_media_type: mobileMediaType,
			mobile_url: mobileUrl,
			mobile_poster_url: String(parsed.mobile_poster_url || '').trim(),
			title: String(parsed.title || DEFAULT_HERO_BANNER.title).trim(),
			subtitle: String(parsed.subtitle || DEFAULT_HERO_BANNER.subtitle).trim(),
			show_overlay_text: parsed.show_overlay_text !== false
		};
	} catch {
		return { ...DEFAULT_HERO_BANNER };
	}
}

export function serializeHeroBanner(settings: HeroBannerSettings): string {
	return JSON.stringify({
		media_type: settings.media_type,
		desktop_url: settings.desktop_url.trim(),
		mobile_media_type: settings.mobile_media_type,
		mobile_url: settings.mobile_url.trim(),
		mobile_poster_url: settings.mobile_poster_url.trim(),
		title: settings.title.trim(),
		subtitle: settings.subtitle.trim(),
		show_overlay_text: settings.show_overlay_text
	});
}
