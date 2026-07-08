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

export function formatQuotationExtraCost(amount: number): string {
	if (amount > 0) return `$${amount.toFixed(2)}`;
	return 'N/A';
}

export interface QuotationSummary {
	productsSubtotalConIva: number;
	shippingCost: number;
	installationCost: number;
	total: number;
	subtotalSinIva: number;
	iva: number;
}

export function calculateQuotationSummary(opts: {
	itemsSubtotalConIva: number;
	generalDiscountAmount?: number;
	shippingCost?: number;
	installationCost?: number;
}): QuotationSummary {
	const discount = opts.generalDiscountAmount ?? 0;
	const shipping = opts.shippingCost ?? 0;
	const installation = opts.installationCost ?? 0;
	const productsSubtotalConIva = opts.itemsSubtotalConIva - discount;
	const total = productsSubtotalConIva + shipping + installation;
	const { subtotalSinIva, iva } = calculateQuotationTaxBreakdown(total);

	return {
		productsSubtotalConIva,
		shippingCost: shipping,
		installationCost: installation,
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
		if (summary.shippingCost > 0) {
			lines.push({
				label: 'Envío:',
				value: `$${summary.shippingCost.toFixed(2)}`
			});
		}
		if (summary.installationCost > 0) {
			lines.push({
				label: 'Instalación:',
				value: `$${summary.installationCost.toFixed(2)}`
			});
		}
		lines.push(
			{ label: 'Subtotal (sin IVA):', value: `$${summary.subtotalSinIva.toFixed(2)}`, separatorBefore: true },
			{ label: 'IVA (16%):', value: `$${summary.iva.toFixed(2)}` },
			{ label: 'Total:', value: `$${summary.total.toFixed(2)} MXN`, bold: true }
		);
	} else {
		lines.push(
			{ label: 'Subtotal con IVA:', value: `$${summary.productsSubtotalConIva.toFixed(2)}` },
			{
				label: 'Envío:',
				value: formatQuotationExtraCost(summary.shippingCost)
			},
			{
				label: 'Instalación:',
				value: formatQuotationExtraCost(summary.installationCost)
			},
			{ label: 'Total:', value: `$${summary.total.toFixed(2)} MXN`, bold: true, separatorBefore: true }
		);
	}

	return lines;
}
