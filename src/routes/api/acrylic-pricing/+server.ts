import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import {
	ACRYLIC_PRICING_SETTINGS_KEY,
	DEFAULT_ACRYLIC_PRICING,
	parseAcrylicPricing
} from '$lib/acrylicPricing';

export const GET: RequestHandler = async () => {
	try {
		const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
		const { data, error } = await supabase
			.from('admin_settings')
			.select('setting_value')
			.eq('setting_key', ACRYLIC_PRICING_SETTINGS_KEY)
			.maybeSingle();

		if (error) {
			return json({
				success: true,
				config: DEFAULT_ACRYLIC_PRICING,
				warning: error.message
			});
		}

		return json({
			success: true,
			config: parseAcrylicPricing((data as any)?.setting_value)
		});
	} catch (error: any) {
		return json({
			success: true,
			config: DEFAULT_ACRYLIC_PRICING,
			warning: error?.message
		});
	}
};
