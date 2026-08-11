import { json, type RequestHandler } from '@sveltejs/kit';
import { getAdminClientAndUser } from '$lib/server/adminAuth';
import {
	ACRYLIC_PRICING_SETTINGS_KEY,
	parseAcrylicPricing,
	serializeAcrylicPricing,
	validateAcrylicPricing,
	type AcrylicPricingConfig
} from '$lib/acrylicPricing';

const MAX_JSON_LENGTH = 20000;

export const GET: RequestHandler = async ({ request }) => {
	try {
		const auth = await getAdminClientAndUser(request);
		if (auth.error) return auth.error;

		const { data, error } = await (auth.supabaseAdmin as any)
			.from('admin_settings')
			.select('setting_value')
			.eq('setting_key', ACRYLIC_PRICING_SETTINGS_KEY)
			.maybeSingle();

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({
			success: true,
			config: parseAcrylicPricing(data?.setting_value)
		});
	} catch (error: any) {
		return json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const auth = await getAdminClientAndUser(request);
		if (auth.error) return auth.error;

		const payload = await request.json();
		const config = parseAcrylicPricing(payload?.config ?? payload);
		const validationError = validateAcrylicPricing(config);
		if (validationError) {
			return json({ success: false, error: validationError }, { status: 400 });
		}

		const serialized = serializeAcrylicPricing(config);
		if (serialized.length > MAX_JSON_LENGTH) {
			return json({ success: false, error: 'Configuración demasiado grande' }, { status: 400 });
		}

		const { error } = await (auth.supabaseAdmin as any).from('admin_settings').upsert(
			{
				setting_key: ACRYLIC_PRICING_SETTINGS_KEY,
				setting_value: serialized,
				updated_by: auth.user.id
			},
			{ onConflict: 'setting_key' }
		);

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({ success: true, config });
	} catch (error: any) {
		return json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
	}
};
