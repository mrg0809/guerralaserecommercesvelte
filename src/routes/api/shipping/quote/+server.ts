/**
 * API Endpoint: Get shipping rate quotes
 * POST /api/shipping/quote
 * 
 * Returns available shipping options and rates from Envia.com
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getShippingRates,
	convertToEnviaAddress,
	calculatePackageDetails,
	getOriginAddress
} from '$lib/services/enviaService';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { cartItems, destination, customerInfo } = body;

		console.log('[SHIPPING QUOTE] Request received:', {
			cartItemsCount: cartItems?.length,
			destination,
			customerInfo
		});

		if (!cartItems || cartItems.length === 0) {
			return json({ error: 'Cart is empty' }, { status: 400 });
		}

		if (!destination || !destination.city || !destination.state || !destination.zip) {
			return json({ error: 'Invalid destination address' }, { status: 400 });
		}

		// Convert addresses to Envia format
		const origin = getOriginAddress();
		const dest = convertToEnviaAddress(destination, customerInfo);

		console.log('[SHIPPING QUOTE] Origin address:', origin);
		console.log('[SHIPPING QUOTE] Destination address:', dest);

		// Calculate package details from cart
		const packages = calculatePackageDetails(cartItems);

		console.log('[SHIPPING QUOTE] Packages calculated:', packages);

		// Check if token is configured
		const enviaToken = process.env.VITE_ENVIA_API_TOKEN;
		if (!enviaToken) {
			console.warn('[SHIPPING QUOTE] ⚠️ VITE_ENVIA_API_TOKEN is not configured');
			return json({
				warning: 'Envia.com token not configured - using mock rates for testing',
				success: true,
				rates: [
					{
						carrier: 'fedex',
						service: 'standard',
						description: 'FedEx Standard (2-3 días)',
						deliveryDays: 3,
						price: 250,
						currency: 'MXN'
					},
					{
						carrier: 'fedex',
						service: 'express',
						description: 'FedEx Express (1-2 días)',
						deliveryDays: 2,
						price: 350,
						currency: 'MXN'
					},
					{
						carrier: 'estafeta',
						service: 'standard',
						description: 'Estafeta Standard (2-3 días)',
						deliveryDays: 3,
						price: 280,
						currency: 'MXN'
					}
				]
			});
		}

		// Request rates from Envia
		const rates = await getShippingRates({
			origin,
			destination: dest,
			packages,
			shipment: {}
		});

		console.log('[SHIPPING QUOTE] Rates from Envia:', rates);

		// Sort by price
		const sortedRates = rates.sort((a, b) => a.amount - b.amount);

		if (sortedRates.length === 0) {
			console.warn('[SHIPPING QUOTE] ⚠️ No rates returned from Envia.com');
			return json({
				warning: 'No shipping rates available for this destination',
				success: true,
				rates: []
			});
		}

		return json({
			success: true,
			rates: sortedRates.map(rate => ({
				carrier: rate.carrier,
				service: rate.service,
				description: rate.serviceDescription,
				deliveryDays: rate.deliveryEstimate,
				price: rate.amount,
				currency: rate.currency
			}))
		});

	} catch (error: any) {
		console.error('[SHIPPING QUOTE] ❌ Error:', error);
		return json(
			{ 
				error: error.message || 'Failed to get shipping rates',
				debug: {
					message: error.message,
					stack: error.stack
				}
			},
			{ status: 500 }
		);
	}
};
