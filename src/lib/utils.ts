export function formatPrice(price: number): string {
	return new Intl.NumberFormat('es-MX', {
		style: 'currency',
		currency: 'MXN'
	}).format(price);
}

export function generateSlug(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export function generateOrderNumber(): string {
	const timestamp = Date.now().toString(36).toUpperCase();
	const random = Math.random().toString(36).substring(2, 7).toUpperCase();
	return `GL-${timestamp}-${random}`;
}

export function truncateText(text: string, length: number): string {
	if (text.length <= length) return text;
	return text.substring(0, length) + '...';
}

// Calcular el precio mínimo de las variantes (solo variantes activas)
export function getMinVariantPrice(variants: any[]): number | null {
	if (!variants || variants.length === 0) return null;
	const prices = variants
		.filter((v) => v.is_active !== false)
		.map((v) => v.price)
		.filter((p) => p !== null && p !== undefined);
	return prices.length > 0 ? Math.min(...prices) : null;
}

// Calcular el stock total de las variantes (solo variantes activas)
export function getTotalVariantStock(variants: any[]): number {
	if (!variants || variants.length === 0) return 0;
	return variants
		.filter((v) => v.is_active !== false)
		.reduce((total, v) => total + (v.stock_quantity || 0), 0);
}

// Obtener el precio a mostrar (con "Desde" si tiene variantes)
export function getDisplayPrice(product: any): { price: number; hasVariants: boolean } {
	const hasVariants = product.product_variants && product.product_variants.length > 0;
	if (hasVariants) {
		const minPrice = getMinVariantPrice(product.product_variants);
		return {
			price: minPrice !== null ? minPrice : product.base_price,
			hasVariants: true
		};
	}
	return {
		price: product.base_price,
		hasVariants: false
	};
}

// Obtener el stock a mostrar (suma de variantes o stock del producto)
export function getDisplayStock(product: any): number {
	const hasVariants = product.product_variants && product.product_variants.length > 0;
	if (hasVariants) {
		return getTotalVariantStock(product.product_variants);
	}
	return product.stock_quantity || 0;
}
