import type { QuotationExtraCostMode } from '$lib/types/quotationExtraCost';
import {
	extraCostBillableAmount,
	formatQuotationExtraCost as formatExtraCostLabel
} from '$lib/types/quotationExtraCost';

export { formatQuotationExtraCost } from '$lib/types/quotationExtraCost';
export type { QuotationExtraCostMode } from '$lib/types/quotationExtraCost';

export const IVA_FACTOR = 1.16;

export function priceWithoutIva(priceWithIva: number): number {
	return Math.round((priceWithIva / IVA_FACTOR) * 100) / 100;
}

export function displayQuotationAmount(amountWithIva: number, excludeIva: boolean): number {
	return excludeIva ? priceWithoutIva(amountWithIva) : amountWithIva;
}

export function calculateQuotationTaxBreakdown(totalConIva: number) {
	const subtotalSinIva = Math.round((totalConIva / IVA_FACTOR) * 100) / 100;
	const iva = Math.round((totalConIva - subtotalSinIva) * 100) / 100;
	return { totalConIva, subtotalSinIva, iva };
}

export interface QuotationSummary {
	productsSubtotalConIva: number;
	shippingCost: number;
	installationCost: number;
	shippingMode: QuotationExtraCostMode;
	installationMode: QuotationExtraCostMode;
	total: number;
	subtotalSinIva: number;
	iva: number;
}

export function calculateQuotationSummary(opts: {
	itemsSubtotalConIva: number;
	generalDiscountAmount?: number;
	shippingCost?: number;
	installationCost?: number;
	shippingMode?: QuotationExtraCostMode | string | null;
	installationMode?: QuotationExtraCostMode | string | null;
}): QuotationSummary {
	const discount = opts.generalDiscountAmount ?? 0;
	const shippingRaw = opts.shippingCost ?? 0;
	const installationRaw = opts.installationCost ?? 0;
	const shippingMode = (opts.shippingMode ?? (shippingRaw > 0 ? 'cost' : 'na')) as QuotationExtraCostMode;
	const installationMode = (opts.installationMode ??
		(installationRaw > 0 ? 'cost' : 'na')) as QuotationExtraCostMode;
	const shipping = extraCostBillableAmount(shippingMode, shippingRaw);
	const installation = extraCostBillableAmount(installationMode, installationRaw);
	const productsSubtotalConIva = opts.itemsSubtotalConIva - discount;
	const total = productsSubtotalConIva + shipping + installation;
	const { subtotalSinIva, iva } = calculateQuotationTaxBreakdown(total);

	return {
		productsSubtotalConIva,
		shippingCost: shippingRaw,
		installationCost: installationRaw,
		shippingMode,
		installationMode,
		total,
		subtotalSinIva,
		iva
	};
}

export type QuotationTotalLine = {
	label: string;
	value: string;
	bold?: boolean;
	red?: boolean;
	separatorBefore?: boolean;
};

export function buildQuotationTotalLines(
	pricesExcludeIva: boolean,
	summary: QuotationSummary,
	opts?: { generalDiscountPercent?: number; generalDiscountAmount?: number }
): QuotationTotalLine[] {
	const lines: QuotationTotalLine[] = [];
	const discount = opts?.generalDiscountAmount ?? 0;
	const discountPct = opts?.generalDiscountPercent ?? 0;

	if (discount > 0) {
		lines.push({
			label: `Descuento${discountPct > 0 ? ` (${discountPct}%)` : ''}:`,
			value: `-$${discount.toFixed(2)}`,
			red: true
		});
	}

	if (pricesExcludeIva) {
		lines.push(
			{
				label: 'Envío:',
				value: formatExtraCostLabel(summary.shippingCost, summary.shippingMode)
			},
			{
				label: 'Instalación:',
				value: formatExtraCostLabel(summary.installationCost, summary.installationMode)
			},
			{ label: 'Subtotal (sin IVA):', value: `$${summary.subtotalSinIva.toFixed(2)}`, separatorBefore: true },
			{ label: 'IVA (16%):', value: `$${summary.iva.toFixed(2)}` },
			{ label: 'Total:', value: `$${summary.total.toFixed(2)} MXN`, bold: true }
		);
	} else {
		lines.push(
			{ label: 'Subtotal con IVA:', value: `$${summary.productsSubtotalConIva.toFixed(2)}` },
			{
				label: 'Envío:',
				value: formatExtraCostLabel(summary.shippingCost, summary.shippingMode)
			},
			{
				label: 'Instalación:',
				value: formatExtraCostLabel(summary.installationCost, summary.installationMode)
			},
			{ label: 'Total:', value: `$${summary.total.toFixed(2)} MXN`, bold: true, separatorBefore: true }
		);
	}

	return lines;
}
