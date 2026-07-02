export const IVA_FACTOR = 1.16;

export function calculateQuotationTaxBreakdown(totalConIva: number) {
	const subtotalSinIva = Math.round((totalConIva / IVA_FACTOR) * 100) / 100;
	const iva = Math.round((totalConIva - subtotalSinIva) * 100) / 100;
	return { totalConIva, subtotalSinIva, iva };
}
