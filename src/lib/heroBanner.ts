export type HeroBannerMediaType = 'video' | 'image';

export const HERO_BANNER_SETTINGS_KEY = 'hero_banner';

export interface HeroBannerSettings {
	media_type: HeroBannerMediaType;
	desktop_url: string;
	mobile_image_url: string;
	title: string;
	subtitle: string;
}

export const DEFAULT_HERO_BANNER: HeroBannerSettings = {
	media_type: 'video',
	desktop_url: 'bannerpagina.mp4',
	mobile_image_url: '',
	title: 'ESPECIALISTAS EN VENTA DE MAQUINARIA',
	subtitle: 'En corte de metales, corte laser co2, fibra óptica, plasma, router, etc.'
};

export function validateHeroBanner(settings: HeroBannerSettings): string | null {
	if (!settings.desktop_url) {
		return 'Debes configurar el media de escritorio';
	}

	if (settings.media_type === 'video' && !settings.mobile_image_url) {
		return 'Cuando el banner es video, debes subir una imagen para móvil';
	}

	if (!settings.title) {
		return 'El título del banner es obligatorio';
	}

	return null;
}

export function parseHeroBanner(raw: string | null | undefined): HeroBannerSettings {
	if (!raw?.trim()) return { ...DEFAULT_HERO_BANNER };

	try {
		const parsed = JSON.parse(raw) as Partial<HeroBannerSettings>;
		const mediaType = parsed.media_type === 'image' ? 'image' : 'video';

		return {
			media_type: mediaType,
			desktop_url: String(parsed.desktop_url || DEFAULT_HERO_BANNER.desktop_url).trim(),
			mobile_image_url: String(parsed.mobile_image_url || '').trim(),
			title: String(parsed.title || DEFAULT_HERO_BANNER.title).trim(),
			subtitle: String(parsed.subtitle || DEFAULT_HERO_BANNER.subtitle).trim()
		};
	} catch {
		return { ...DEFAULT_HERO_BANNER };
	}
}

export function serializeHeroBanner(settings: HeroBannerSettings): string {
	return JSON.stringify({
		media_type: settings.media_type,
		desktop_url: settings.desktop_url.trim(),
		mobile_image_url: settings.mobile_image_url.trim(),
		title: settings.title.trim(),
		subtitle: settings.subtitle.trim()
	});
}
