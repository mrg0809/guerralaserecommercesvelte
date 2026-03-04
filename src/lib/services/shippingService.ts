/**
 * Simple Shipping Service - Without Envia.com
 * 
 * Gets shipping options based on product shipping_type_id
 * No external API calls, just database lookups
 */

import { supabase } from '$lib/supabaseClient';

export interface ShippingType {
	id: string;
	name: string;
	description: string;
	carrier: string;
	service: string;
	base_price: number;
	estimated_days: number;
	is_active: boolean;
}

/**
 * Get available shipping options for cart items
 * Combines shipping types from all products and calculates totals
 */
export async function getShippingOptionsForCart(cartItems: any[]): Promise<ShippingType[]> {
	if (!cartItems || cartItems.length === 0) {
		return [];
	}

	try {
		// Get unique shipping type IDs from cart items and product compatibility table
		const shippingTypeIds = new Set<string>();
		const productIds = new Set<string>();
		let hasQuotationRequired = false;
		let hasUnassignedProducts = false;

		for (const item of cartItems) {
			if (item.product?.id) {
				productIds.add(item.product.id);
			}

			if (item.product.shipping_type_id) {
				shippingTypeIds.add(item.product.shipping_type_id);
			} else {
				hasUnassignedProducts = true;
			}

			// Check if product requires quotation
			if (item.product.requires_quotation) {
				hasQuotationRequired = true;
			}
		}

		if (productIds.size > 0) {
			const { data: productShippingTypes } = await (supabase as any)
				.from('product_shipping_types')
				.select('product_id, shipping_type_id')
				.in('product_id', Array.from(productIds));

			const mappedProductIds = new Set<string>();

			if (productShippingTypes && productShippingTypes.length > 0) {
				for (const row of productShippingTypes) {
					if (row.product_id) {
						mappedProductIds.add(row.product_id);
					}

					if (row.shipping_type_id) {
						shippingTypeIds.add(row.shipping_type_id);
					}
				}

				if (mappedProductIds.size === productIds.size) {
					hasUnassignedProducts = false;
				}
			}
		}

		// If any product has no shipping type, include FedEx Standard as fallback
		if (hasUnassignedProducts) {
			const { data: fallbackShippingType } = await (supabase as any)
				.from('shipping_types')
				.select('id')
				.eq('name', 'FedEx Standard')
				.single();

			if (fallbackShippingType?.id) {
				shippingTypeIds.add(fallbackShippingType.id);
			}
		}

		// Fetch shipping types from database
		if (shippingTypeIds.size > 0) {
			const { data: shippingTypes, error } = await (supabase as any)
				.from('shipping_types')
				.select('*')
				.in('id', Array.from(shippingTypeIds))
				.eq('is_active', true)
				.order('display_order');

			if (error) throw error;

			// If any item requires quotation, also add the quotation option
			if (hasQuotationRequired) {
				const { data: quotationOption } = await (supabase as any)
					.from('shipping_types')
					.select('*')
					.eq('name', 'Cotización Personalizada')
					.single();

				if (quotationOption) {
					shippingTypes.push(quotationOption);
				}
			}

			return (shippingTypes || []) as ShippingType[];
		}

		return [];
	} catch (error) {
		console.error('Error getting shipping options:', error);
		return [];
	}
}

/**
 * Check if cart requires quotation (contains heavy machinery)
 */
export function cartRequiresQuotation(cartItems: any[]): boolean {
	return cartItems.some(item => 
		item.product.requires_quotation || 
		item.product.shipping_type?.name === 'Cotización Personalizada'
	);
}

/**
 * Get label for checkout button based on cart items
 */
export function getCheckoutButtonLabel(cartItems: any[]): string {
	if (cartRequiresQuotation(cartItems)) {
		return 'Solicitar Cotización de Envío';
	}
	return 'Proceder al Pago';
}

/**
 * Calculate total shipping cost for cart
 * May include multiple shipping types if products have different shipping needs
 */
export function calculateShippingCost(
	cartItems: any[],
	selectedShippingType: ShippingType | null
): number {
	if (!selectedShippingType) {
		return 0;
	}

	// For now, use base price from shipping type
	// In the future, could have qty-based pricing
	return selectedShippingType.base_price;
}
