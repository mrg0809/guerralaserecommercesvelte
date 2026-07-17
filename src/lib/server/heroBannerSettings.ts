import { supabaseServer } from '$lib/supabaseServer';
import {
	HERO_BANNER_SETTINGS_KEY,
	parseHeroBanner,
	DEFAULT_HERO_BANNER
} from '$lib/heroBanner';

export {
	HERO_BANNER_SETTINGS_KEY,
	parseHeroBanner,
	serializeHeroBanner,
	validateHeroBanner,
	DEFAULT_HERO_BANNER,
	type HeroBannerSettings,
	type HeroBannerMediaType
} from '$lib/heroBanner';

export async function getHeroBannerSettings() {
	try {
		const { data } = await (supabaseServer as any)
			.from('admin_settings')
			.select('setting_value')
			.eq('setting_key', HERO_BANNER_SETTINGS_KEY)
			.maybeSingle();

		return parseHeroBanner(data?.setting_value);
	} catch (error) {
		console.error('[HERO BANNER] Error leyendo configuración:', error);
		return { ...DEFAULT_HERO_BANNER };
	}
}
