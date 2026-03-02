/**
 * API Endpoint: Create shipment and generate label
 * POST /api/shipping/create
 * 
 * Creates a shipment with Envia.com and returns tracking number and label
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createShipment,
	convertToEnviaAddress,
	calculatePackageDetails,
	getOriginAddress
} from '$lib/services/enviaService';
import { supabase } from '$lib/supabaseClient';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { orderId, carrier, service, destination, customerInfo, cartItems } = body;

		if (!orderId) {
			return json({ error: 'Order ID is required' }, { status: 400 });
		}

		if (!carrier || !service) {
			return json({ error: 'Carrier and service are required' }, { status: 400 });
		}

		// Convert addresses to Envia format
		const origin = getOriginAddress();
		const dest = convertToEnviaAddress(destination, customerInfo);

		// Calculate package details
		const packages = calculatePackageDetails(cartItems);

		// Create shipment with Envia
		const shipment = await createShipment({
			origin,
			destination: dest,
			packages,
			carrier,
			service,
			shipment: {
				carrier
			}
		});

		// Update order in database with shipping info
		const { error: updateError } = await supabase
			.from('orders')
			.update({
				shipping_carrier: shipment.carrier,
				shipping_service: shipment.service,
				shipping_tracking_number: shipment.trackingNumber,
				shipping_label_url: shipment.labelUrl,
				shipping_cost: shipment.cost,
				shipping_status: 'label_created'
			})
			.eq('id', orderId);

		if (updateError) {
			console.error('Error updating order:', updateError);
			// Don't fail the request, shipment was created successfully
		}

		return json({
			success: true,
			shipment: {
				id: shipment.shipmentId,
				trackingNumber: shipment.trackingNumber,
				labelUrl: shipment.labelUrl,
				carrier: shipment.carrier,
				service: shipment.service,
				cost: shipment.cost
			}
		});

	} catch (error: any) {
		console.error('Error creating shipment:', error);
		return json(
			{ error: error.message || 'Failed to create shipment' },
			{ status: 500 }
		);
	}
};
