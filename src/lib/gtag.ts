/**
 * Google Analytics (gtag.js) utility functions
 * Carga diferida con cola de eventos hasta que el script esté listo
 */

const GA_MEASUREMENT_ID = 'G-EG2D20MZJ8';
const AW_CONVERSION_ID = 'AW-950721855';

let gaInitialized = false;
const eventQueue: Array<() => void> = [];

function flushEventQueue() {
	for (const send of eventQueue) {
		send();
	}
	eventQueue.length = 0;
}

function isGtagAvailable(): boolean {
	if (typeof window === 'undefined') return false;
	return typeof (window as any).gtag === 'function';
}

function queueOrRun(send: () => void) {
	if (isGtagAvailable()) {
		send();
		return;
	}
	eventQueue.push(send);
}

/**
 * Carga gtag.js de forma diferida (llamar desde onMount del layout)
 */
export function loadGoogleAnalytics(): void {
	if (typeof window === 'undefined' || gaInitialized) return;
	gaInitialized = true;

	const w = window as any;
	w.dataLayer = w.dataLayer || [];
	function gtag(...args: unknown[]) {
		w.dataLayer.push(args);
	}
	w.gtag = gtag;
	gtag('js', new Date());

	const script = document.createElement('script');
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
	script.onload = () => {
		gtag('config', GA_MEASUREMENT_ID);
		gtag('config', AW_CONVERSION_ID);
		flushEventQueue();
	};
	document.head.appendChild(script);
}

/**
 * Dispara un evento de page_view para rastrear cambios de URL (SPA)
 */
export function trackPageView(path: string, title?: string) {
	queueOrRun(() => {
		(window as any).gtag('event', 'page_view', {
			page_path: path,
			page_title: title || document.title
		});
	});
}

/**
 * Dispara un evento personalizado
 */
export function trackEvent(eventName: string, eventData?: Record<string, unknown>) {
	queueOrRun(() => {
		(window as any).gtag('event', eventName, eventData || {});
	});
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
 */
export function trackConversion(eventName: string, conversionValue?: number, currency?: string) {
	const eventData: Record<string, unknown> = {};
	if (conversionValue !== undefined) {
		eventData.value = conversionValue;
	}
	if (currency) {
		eventData.currency = currency;
	}
	trackEvent(eventName, eventData);
}
