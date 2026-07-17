import { json, type RequestHandler } from '@sveltejs/kit';
import { getAdminClientAndUser } from '$lib/server/adminAuth';
import {
	HERO_BANNER_SETTINGS_KEY,
	parseHeroBanner,
	serializeHeroBanner,
	validateHeroBanner,
	type HeroBannerSettings
} from '$lib/heroBanner';

const MAX_JSON_LENGTH = 4000;

export const GET: RequestHandler = async ({ request }) => {
	try {
		const auth = await getAdminClientAndUser(request);
		if (auth.error) return auth.error;

		const { data, error } = await (auth.supabaseAdmin as any)
			.from('admin_settings')
			.select('setting_value')
			.eq('setting_key', HERO_BANNER_SETTINGS_KEY)
			.maybeSingle();

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({
			success: true,
			heroBanner: parseHeroBanner(data?.setting_value)
		});
	} catch (error: any) {
		return json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const auth = await getAdminClientAndUser(request);
		if (auth.error) return auth.error;

		const payload = await request.json();
		const settings: HeroBannerSettings = {
			media_type: payload?.media_type === 'image' ? 'image' : 'video',
			desktop_url: String(payload?.desktop_url || '').trim(),
			mobile_media_type: payload?.mobile_media_type === 'video' ? 'video' : 'image',
			mobile_url: String(payload?.mobile_url || payload?.mobile_image_url || '').trim(),
			mobile_poster_url: String(payload?.mobile_poster_url || '').trim(),
			title: String(payload?.title || '').trim(),
			subtitle: String(payload?.subtitle || '').trim(),
			show_overlay_text: payload?.show_overlay_text !== false
		};

		const validationError = validateHeroBanner(settings);
		if (validationError) {
			return json({ success: false, error: validationError }, { status: 400 });
		}

		const serialized = serializeHeroBanner(settings);
		if (serialized.length > MAX_JSON_LENGTH) {
			return json(
				{ success: false, error: `La configuración excede el límite de ${MAX_JSON_LENGTH} caracteres` },
				{ status: 400 }
			);
		}

		const { error } = await (auth.supabaseAdmin as any).from('admin_settings').upsert(
			{
				setting_key: HERO_BANNER_SETTINGS_KEY,
				setting_value: serialized,
				updated_by: auth.user.id
			},
			{
				onConflict: 'setting_key'
			}
		);

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({ success: true, heroBanner: settings });
	} catch (error: any) {
		return json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
	}
};
