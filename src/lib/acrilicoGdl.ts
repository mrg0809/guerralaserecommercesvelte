import { formatPrice, normalizeSearchText } from '$lib/utils';
import { DEFAULT_WHATSAPP_PHONE } from '$lib/whatsappRouting';
import { trackAdsConversion, trackWhatsAppContact } from '$lib/gtag';
import type { CartItem } from '$lib/types';

export const ACRILICO_GDL_SOURCE = 'acrilico-gdl' as const;
export const ACRILICO_GDL_PATH = '/acrilico-gdl';
export const ACRILICO_GDL_SITE_URL = 'https://guerralaser.com/acrilico-gdl';
export const ZMG_FREE_SHIPPING_MIN = 5000;
export const ACRILICO_GDL_CAMPAIGN_STORAGE_KEY = 'acrilico_gdl_campaign';
export const ACRILICO_GDL_WHATSAPP_CONTEXT = 'acrilico_gdl';

/**
 * Pega aquí el label de Google Ads (AW-950721855/xxxxx) cuando crees
 * la conversión “WhatsApp acrílico GDL”. Mientras sea null solo se envía GA4.
 */
export const AW_WHATSAPP_GDL_SEND_TO: string | null = null;

export const GDL_WAREHOUSE_ADDRESS = {
	street: 'Av. Las Torres 5301, Col. Glorias del Colli',
	city: 'Zapopan',
	state: 'Jalisco',
	zip_code: '45010',
	country: 'México'
} as const;

export const GDL_WAREHOUSE_LABEL =
	'Av. Las Torres 5301, Col. Glorias del Colli, Zapopan, Jalisco CP 45010';

const ZMG_MUNICIPALITIES = [
	'guadalajara',
	'zapopan',
	'tlaquepaque',
	'san pedro tlaquepaque',
	'tonala',
	'tlajomulco',
	'tlajomulco de zuniga',
	'el salto',
	'juanacatlan',
	'ixtlahuacan',
	'ixtlahuacan de los membrillos',
	'zapotlanejo'
];

const CAMPAIGN_PARAM_KEYS = [
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_content',
	'utm_term',
	'gclid',
	'gbraid',
	'wbraid'
] as const;

export type GdlCampaignParams = Partial<Record<(typeof CAMPAIGN_PARAM_KEYS)[number], string>>;

export type GdlFulfillmentId = 'gdl-pickup' | 'gdl-local-free' | 'gdl-local-whatsapp';

export type GdlShippingOption = {
	id: GdlFulfillmentId;
	name: string;
	description: string;
	carrier: string;
	service: string;
	price: number;
	estimatedDays: number;
	whatsappQuote?: boolean;
};

export function isGdlAcrylicCart(items: CartItem[] | null | undefined): boolean {
	if (!items || items.length === 0) return false;
	return items.every((item) => item.source === ACRILICO_GDL_SOURCE);
}

export function isZmgAddress(city: string, zip?: string): boolean {
	const normalizedCity = normalizeSearchText(city);
	if (normalizedCity && ZMG_MUNICIPALITIES.some((m) => normalizedCity.includes(m))) {
		return true;
	}
	const zip5 = String(zip || '')
		.replace(/\D/g, '')
		.slice(0, 5);
	const n = Number(zip5);
	return Number.isFinite(n) && n >= 44100 && n <= 45999;
}

export function persistAcrilicoGdlCampaign(searchParams: URLSearchParams): void {
	if (typeof window === 'undefined') return;
	const existing = getAcrilicoGdlCampaign();
	const next: GdlCampaignParams = { ...existing };
	let changed = false;
	for (const key of CAMPAIGN_PARAM_KEYS) {
		const value = searchParams.get(key);
		if (value) {
			next[key] = value;
			changed = true;
		}
	}
	if (changed) {
		sessionStorage.setItem(ACRILICO_GDL_CAMPAIGN_STORAGE_KEY, JSON.stringify(next));
	}
}

export function getAcrilicoGdlCampaign(): GdlCampaignParams {
	if (typeof window === 'undefined') return {};
	try {
		const raw = sessionStorage.getItem(ACRILICO_GDL_CAMPAIGN_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

export function campaignLineForWhatsApp(): string {
	const params = getAcrilicoGdlCampaign();
	const parts = CAMPAIGN_PARAM_KEYS.map((key) =>
		params[key] ? `${key}=${params[key]}` : ''
	).filter(Boolean);
	return parts.length ? `Campaña: ${parts.join(' | ')}` : '';
}

export function trackAcrilicoGdlWhatsApp(context = ACRILICO_GDL_WHATSAPP_CONTEXT): void {
	trackWhatsAppContact(context);
	trackAdsConversion(AW_WHATSAPP_GDL_SEND_TO);
}

export function openAcrilicoGdlWhatsApp(message: string, context = ACRILICO_GDL_WHATSAPP_CONTEXT): void {
	const campaign = campaignLineForWhatsApp();
	const full = campaign ? `${message}\n${campaign}` : message;
	trackAcrilicoGdlWhatsApp(context);
	const url = `https://wa.me/${DEFAULT_WHATSAPP_PHONE}?text=${encodeURIComponent(full)}`;
	window.open(url, '_blank', 'noopener,noreferrer');
}

export function getGdlCartItems(items: CartItem[] | null | undefined): CartItem[] {
	return (items || []).filter((item) => item.source === ACRILICO_GDL_SOURCE);
}

export function gdlCartSubtotal(items: CartItem[]): number {
	return items.reduce((sum, item) => sum + cartLineUnitPrice(item) * item.quantity, 0);
}

export function isSameAcrylicLine(a: CartItem, b: CartItem): boolean {
	const cutKey = (item: CartItem) => {
		const c = item.acrylicCut;
		if (!c) return '';
		return `${c.size_id}:${c.width_cm}x${c.height_cm}:${c.unit_price}`;
	};
	return a.product.id === b.product.id && a.variant?.id === b.variant?.id && cutKey(a) === cutKey(b);
}

export function mergePendingGdlLine(items: CartItem[], pending: CartItem | null | undefined): CartItem[] {
	if (!pending) return [...items];
	if (items.some((item) => isSameAcrylicLine(item, pending))) return [...items];
	return [...items, pending];
}

export function buildLandingProductWhatsAppMessage(params: {
	productName: string;
	color: string;
	grosor: string;
	sizeLabel: string;
	quantity: number;
	price: number;
}): string {
	return buildGdlCartWhatsAppMessage([
		{
			product: { id: 'pending', name: params.productName, base_price: params.price } as CartItem['product'],
			quantity: params.quantity,
			variant: {
				id: 'pending',
				name: [params.color, params.grosor].filter(Boolean).join(' '),
				attributes: { color: params.color, grosor: params.grosor }
			} as CartItem['variant'],
			acrylicCut: {
				size_id: 'pending',
				width_cm: 0,
				height_cm: 0,
				unit_price: params.quantity > 0 ? params.price / params.quantity : params.price,
				label: params.sizeLabel
			},
			source: ACRILICO_GDL_SOURCE
		}
	]);
}

export function buildLandingGeneralWhatsAppMessage(): string {
	return [
		`Hola, vengo de acrílico en Guadalajara (${ACRILICO_GDL_SITE_URL}).`,
		'Me interesa recoger en bodega o entrega local en la ZMG.'
	].join('\n');
}

function cartLineUnitPrice(item: CartItem): number {
	if (item.bundle) return item.bundle.bundle_price;
	if (item.acrylicCut?.unit_price != null) return item.acrylicCut.unit_price;
	if (item.variant) return item.variant.price;
	return item.product.base_price;
}

function variantAttr(item: CartItem, key: string): string {
	const attrs = item.variant?.attributes;
	if (!attrs || typeof attrs !== 'object') return '';
	const value = (attrs as Record<string, unknown>)[key];
	return value == null ? '' : String(value).trim();
}

function cartLineWhatsAppBlock(item: CartItem, index: number): string {
	const color = variantAttr(item, 'color');
	const grosor = variantAttr(item, 'grosor');
	const size = item.acrylicCut?.label || '';
	const unit = cartLineUnitPrice(item);
	const details = [
		color ? `Color: ${color}` : '',
		grosor ? `Grosor: ${grosor}` : '',
		size ? `Tamaño: ${size}` : item.variant?.name ? `Variante: ${item.variant.name}` : ''
	].filter(Boolean);
	return [
		`${index + 1}) ${item.product.name}`,
		details.length ? `   ${details.join(' · ')}` : '',
		`   Cantidad: ${item.quantity} · ${formatPrice(unit * item.quantity)}`
	]
		.filter(Boolean)
		.join('\n');
}

export function buildGdlCartWhatsAppMessage(items: CartItem[]): string {
	if (items.length === 0) return buildLandingGeneralWhatsAppMessage();
	const subtotal = gdlCartSubtotal(items);
	const shippingLine =
		subtotal >= ZMG_FREE_SHIPPING_MIN
			? `Envío ZMG: GRATIS (compra de ${formatPrice(ZMG_FREE_SHIPPING_MIN)} o más)`
			: `Envío ZMG: coordinar (gratis desde ${formatPrice(ZMG_FREE_SHIPPING_MIN)})`;

	return [
		`Hola, vengo de acrílico en Guadalajara (${ACRILICO_GDL_SITE_URL}).`,
		'',
		`Quiero este pedido (${items.reduce((sum, item) => sum + item.quantity, 0)} pzas):`,
		'',
		...items.map((item, index) => cartLineWhatsAppBlock(item, index)),
		'',
		`Subtotal: ${formatPrice(subtotal)}`,
		shippingLine,
		'',
		'Me interesa recoger en bodega o entrega local en la ZMG.'
	].join('\n');
}

export function buildCheckoutLocalDeliveryWhatsAppMessage(params: {
	customerName: string;
	customerPhone: string;
	street: string;
	city: string;
	zip: string;
	items: CartItem[];
	subtotal: number;
}): string {
	const shippingLine =
		params.subtotal >= ZMG_FREE_SHIPPING_MIN
			? `Envío: GRATIS (compra de ${formatPrice(ZMG_FREE_SHIPPING_MIN)} o más)`
			: 'Envío: Coordinar costo de entrega local';

	return [
		'Hola, quiero entrega local en la ZMG.',
		'',
		`Cliente: ${params.customerName || 'Sin nombre'} | Tel: ${params.customerPhone || 'Sin teléfono'}`,
		`Dirección: ${params.street || '—'}, ${params.city || '—'}, ${params.zip || '—'}`,
		'',
		'Pedido:',
		...params.items.map((item, index) => cartLineWhatsAppBlock(item, index)),
		'',
		`Subtotal: ${formatPrice(params.subtotal)}`,
		shippingLine,
		`Origen: ${ACRILICO_GDL_SITE_URL}`
	].join('\n');
}

export function getGdlShippingOptions(subtotal: number): GdlShippingOption[] {
	const pickup: GdlShippingOption = {
		id: 'gdl-pickup',
		name: 'Recoger en bodega',
		description: `Paga ahora y recoge en ${GDL_WAREHOUSE_LABEL}`,
		carrier: 'Bodega',
		service: 'Recoger en bodega',
		price: 0,
		estimatedDays: 0
	};

	if (subtotal >= ZMG_FREE_SHIPPING_MIN) {
		return [
			pickup,
			{
				id: 'gdl-local-free',
				name: 'Entrega local ZMG',
				description: `Envío gratis en zona metropolitana (compra de ${formatPrice(ZMG_FREE_SHIPPING_MIN)} o más)`,
				carrier: 'Local',
				service: 'Entrega local ZMG',
				price: 0,
				estimatedDays: 1
			}
		];
	}

	return [
		pickup,
		{
			id: 'gdl-local-whatsapp',
			name: 'Entrega local ZMG',
			description: 'Coordinar entrega por WhatsApp. Te enviamos la cotización con tu pedido listo.',
			carrier: 'Local',
			service: 'Entrega local ZMG',
			price: 0,
			estimatedDays: 1,
			whatsappQuote: true
		}
	];
}

export function isGdlWhatsAppDeliveryOption(option: { id?: string } | null | undefined): boolean {
	return option?.id === 'gdl-local-whatsapp';
}

export function isGdlPickupOption(option: { id?: string } | null | undefined): boolean {
	return option?.id === 'gdl-pickup';
}

export function isGdlLocalDeliveryOption(option: { id?: string } | null | undefined): boolean {
	return option?.id === 'gdl-local-free' || option?.id === 'gdl-local-whatsapp';
}

export function gdlOrderNotes(params: {
	userNotes?: string;
	fulfillmentId?: string;
}): string {
	const lines = [
		params.userNotes?.trim() || '',
		'origen=acrilico-gdl',
		params.fulfillmentId === 'gdl-pickup'
			? 'cumplimiento=recoger-bodega'
			: params.fulfillmentId
				? 'cumplimiento=entrega-local-zmg'
				: ''
	].filter(Boolean);
	return lines.join('\n');
}
