/**
 * API Endpoint: Track shipment
 * GET /api/shipping/track?tracking={trackingNumber}&carrier={carrier}
 * 
 * Returns current tracking status from Envia.com
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { trackShipment } from '$lib/services/enviaService';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const trackingNumber = url.searchParams.get('tracking');
		const carrier = url.searchParams.get('carrier');

		if (!trackingNumber || !carrier) {
			return json(
				{ error: 'Tracking number and carrier are required' },
				{ status: 400 }
			);
		}

		const trackingInfo = await trackShipment(trackingNumber, carrier);

		return json({
			success: true,
			tracking: trackingInfo
		});

	} catch (error: any) {
		console.error('Error tracking shipment:', error);
		return json(
			{ error: error.message || 'Failed to track shipment' },
			{ status: 500 }
		);
	}
};
