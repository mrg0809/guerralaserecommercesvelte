import { supabaseServer } from '$lib/supabaseServer';

const DEFAULT_NOTIFICATIONS_EMAIL = process.env.ORDER_NOTIFICATIONS_EMAIL || 'contacto@guerralaser.com';
const SETTINGS_KEY = 'order_notification_emails';

function normalizeEmailList(raw: string | null | undefined): string[] {
	if (!raw) return [];

	const uniqueEmails = new Set<string>();
	const parts = raw
		.split(/[\n,;]+/)
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);

	for (const email of parts) {
		uniqueEmails.add(email);
	}

	return Array.from(uniqueEmails);
}

export async function getOrderNotificationRecipients(): Promise<string[]> {
	try {
		const { data } = await (supabaseServer as any)
			.from('admin_settings')
			.select('setting_value')
			.eq('setting_key', SETTINGS_KEY)
			.maybeSingle();

		const configuredEmails = normalizeEmailList(data?.setting_value);
		if (configuredEmails.length > 0) {
			return configuredEmails;
		}
	} catch (error) {
		console.error('[ORDER NOTIFICATIONS] Error leyendo configuración de correos:', error);
	}

	return normalizeEmailList(DEFAULT_NOTIFICATIONS_EMAIL);
}

export { SETTINGS_KEY as ORDER_NOTIFICATION_EMAILS_SETTINGS_KEY };
