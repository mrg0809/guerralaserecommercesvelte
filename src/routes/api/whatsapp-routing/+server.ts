import { json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import {
	buildWhatsAppRoutingConfig,
	DEFAULT_WHATSAPP_PHONE,
	type WhatsappAgent
} from '$lib/whatsappRouting';

export const GET: RequestHandler = async () => {
	try {
		const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

		const { data: agents, error } = await supabase
			.from('whatsapp_agents')
			.select('id, label, phone, is_default, is_active, whatsapp_agent_categories(category_id)')
			.eq('is_active', true);

		if (error) {
			return json({
				success: true,
				routing: {
					defaultPhone: DEFAULT_WHATSAPP_PHONE,
					categoryPhoneMap: {}
				},
				warning: error.message
			});
		}

		const mapped: WhatsappAgent[] = (agents || []).map((a: any) => ({
			id: a.id,
			label: a.label,
			phone: a.phone,
			is_default: !!a.is_default,
			is_active: true,
			category_ids: (a.whatsapp_agent_categories || [])
				.map((l: any) => l.category_id)
				.filter(Boolean)
		}));

		return json({
			success: true,
			routing: buildWhatsAppRoutingConfig(mapped)
		});
	} catch (error: any) {
		return json({
			success: true,
			routing: {
				defaultPhone: DEFAULT_WHATSAPP_PHONE,
				categoryPhoneMap: {}
			},
			warning: error?.message
		});
	}
};
