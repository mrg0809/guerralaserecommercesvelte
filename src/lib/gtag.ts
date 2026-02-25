/**
 * Google Analytics (gtag.js) utility functions
 * Safe client-side tracking with gtag verification
 */

/**
 * Verifica si gtag está disponible en el cliente
 */
function isGtagAvailable(): boolean {
	if (typeof window === 'undefined') return false;
	return typeof (window as any).gtag === 'function';
}

/**
 * Dispara un evento de page_view para rastrear cambios de URL (SPA)
 * @param path - Ruta de la página
 * @param title - Título de la página (opcional)
 */
export function trackPageView(path: string, title?: string) {
	if (!isGtagAvailable()) return;

	(window as any).gtag('event', 'page_view', {
		page_path: path,
		page_title: title || document.title
	});
}

/**
 * Dispara un evento personalizado
 * @param eventName - Nombre del evento
 * @param eventData - Datos adicionales del evento
 */
export function trackEvent(eventName: string, eventData?: Record<string, any>) {
	if (!isGtagAvailable()) return;

	(window as any).gtag('event', eventName, eventData || {});
}

/**
 * Rastreo de contacto por WhatsApp
 */
export function trackWhatsAppContact(context?: string) {
	trackEvent('contact_whatsapp', {
		context: context || 'direct',
		timestamp: new Date().toISOString()
	});
}

/**
 * Rastreo de conversión general
 * @param conversionValue - Valor de la conversión (opcional)
 * @param currency - Moneda (opcional)
 */
export function trackConversion(eventName: string, conversionValue?: number, currency?: string) {
	const eventData: Record<string, any> = {};
	if (conversionValue !== undefined) {
		eventData.value = conversionValue;
	}
	if (currency) {
		eventData.currency = currency;
	}
	trackEvent(eventName, eventData);
}
