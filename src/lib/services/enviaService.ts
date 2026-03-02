/**
 * Envia.com API Integration Service
 * 
 * This service handles all interactions with the Envia.com shipping API
 * including rate quotes, label generation, and shipment tracking.
 * 
 * API Documentation: https://api.envia.com/doc
 */

const ENVIA_API_URL = 'https://api.envia.com';

interface EnviaAddress {
	name: string;
	company?: string;
	email: string;
	phone: string;
	street: string;
	number?: string;
	district?: string;
	city: string;
	state: string;
	country: string;
	postalCode: string;
	reference?: string;
}

interface EnviaPackage {
	content: string;
	amount: number;
	type: string; // 'box', 'envelope', 'pallet'
	weight: number; // in kg
	insurance: number;
	declaredValue: number;
	weightUnit: 'KG';
	lengthUnit: 'CM';
	dimensions?: {
		length: number;
		width: number;
		height: number;
	};
}

interface EnviaRateRequest {
	origin: EnviaAddress;
	destination: EnviaAddress;
	packages: EnviaPackage[];
	shipment: {
		carrier?: string; // 'fedex', 'dhl', 'estafeta', 'redpack', etc.
	};
}

interface EnviaRate {
	carrier: string;
	service: string;
	serviceDescription: string;
	deliveryEstimate: number; // days
	amount: number;
	currency: string;
}

interface EnviaShipmentRequest extends EnviaRateRequest {
	carrier: string;
	service: string;
}

interface EnviaShipmentResponse {
	shipmentId: string;
	trackingNumber: string;
	labelUrl: string;
	carrier: string;
	service: string;
	cost: number;
}

/**
 * Get the Envia.com API token from environment variables
 */
function getEnviaToken(): string {
	const token = import.meta.env.VITE_ENVIA_API_TOKEN;
	if (!token) {
		throw new Error('ENVIA_API_TOKEN not configured');
	}
	return token;
}

/**
 * Make an authenticated request to the Envia.com API
 */
async function enviaRequest<T>(
	endpoint: string,
	method: string = 'GET',
	body?: any
): Promise<T> {
	const token = process.env.VITE_ENVIA_API_TOKEN;
	
	if (!token) {
		console.warn('[ENVIA] No token configured, returning empty response');
		return { data: [] } as T;
	}

	const url = `${ENVIA_API_URL}${endpoint}`;
	
	console.log(`[ENVIA] ${method} ${url}`);
	console.log('[ENVIA] Request body:', JSON.stringify(body, null, 2));

	try {
		const response = await fetch(url, {
			method,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			body: body ? JSON.stringify(body) : undefined
		});

		console.log(`[ENVIA] Response status: ${response.status}`);

		const responseText = await response.text();
		console.log('[ENVIA] Response body:', responseText);

		if (!response.ok) {
			let error: any;
			try {
				error = JSON.parse(responseText);
			} catch (e) {
				error = { message: responseText || `HTTP ${response.status}` };
			}
			throw new Error(error.message || `Envia API error: ${response.status}`);
		}

		const data = responseText ? JSON.parse(responseText) : {};
		console.log('[ENVIA] Parsed response:', data);
		
		return data as T;
	} catch (error) {
		console.error('[ENVIA] ❌ Request failed:', error);
		throw error;
	}
}

/**
 * Get shipping rate quotes from multiple carriers
 */
export async function getShippingRates(request: EnviaRateRequest): Promise<EnviaRate[]> {
	try {
		console.log('[ENVIA RATES] Getting rates for request:', JSON.stringify(request, null, 2));
		
		const response = await enviaRequest<{ data: EnviaRate[] }>(
			'/ship/rate/',
			'POST',
			request
		);
		
		const rates = response.data || [];
		console.log('[ENVIA RATES] Got rates:', rates);
		
		return rates;
	} catch (error) {
		console.error('[ENVIA RATES] ❌ Error getting shipping rates:', error);
		return [];
	}
}

/**
 * Create a shipment and generate shipping label
 */
export async function createShipment(
	request: EnviaShipmentRequest
): Promise<EnviaShipmentResponse> {
	try {
		const response = await enviaRequest<{ data: EnviaShipmentResponse }>(
			'/ship/generate/',
			'POST',
			request
		);
		
		if (!response.data) {
			throw new Error('Invalid response from Envia API');
		}
		
		return response.data;
	} catch (error) {
		console.error('Error creating shipment:', error);
		throw error;
	}
}

/**
 * Track a shipment by tracking number
 */
export async function trackShipment(trackingNumber: string, carrier: string) {
	try {
		const response = await enviaRequest<any>(
			`/ship/track/${carrier}/${trackingNumber}`,
			'GET'
		);
		return response.data;
	} catch (error) {
		console.error('Error tracking shipment:', error);
		throw error;
	}
}

/**
 * Cancel a shipment
 */
export async function cancelShipment(shipmentId: string): Promise<boolean> {
	try {
		await enviaRequest<any>(
			`/ship/cancel/${shipmentId}`,
			'DELETE'
		);
		return true;
	} catch (error) {
		console.error('Error canceling shipment:', error);
		return false;
	}
}

/**
 * Helper: Convert our address format to Envia format
 */
export function convertToEnviaAddress(address: {
	street: string;
	city: string;
	state: string;
	zip: string;
	country: string;
}, contact: {
	name: string;
	email: string;
	phone: string;
	company?: string;
}): EnviaAddress {
	return {
		name: contact.name,
		company: contact.company,
		email: contact.email,
		phone: contact.phone,
		street: address.street,
		city: address.city,
		state: address.state,
		country: address.country,
		postalCode: address.zip,
	};
}

/**
 * Helper: Calculate package dimensions and weight from cart items
 */
export function calculatePackageDetails(items: any[]): EnviaPackage[] {
	// Group items by shipping type
	const standardItems = items.filter(item => 
		!item.product.shipping_type || item.product.shipping_type === 'standard'
	);
	const delicateItems = items.filter(item => 
		item.product.shipping_type === 'delicate'
	);
	const heavyItems = items.filter(item => 
		item.product.shipping_type === 'heavy'
	);

	const packages: EnviaPackage[] = [];

	// Standard items package (small parts, consumables)
	if (standardItems.length > 0) {
		const totalValue = standardItems.reduce((sum, item) => {
			const price = item.variant ? item.variant.price : item.product.base_price;
			return sum + (price * item.quantity);
		}, 0);

		packages.push({
			content: 'Refacciones y consumibles',
			amount: standardItems.reduce((sum, item) => sum + item.quantity, 0),
			type: 'box',
			weight: standardItems.length * 0.5, // Estimate 0.5kg per item
			insurance: totalValue * 0.1, // 10% insurance
			declaredValue: totalValue,
			weightUnit: 'KG',
			lengthUnit: 'CM',
			dimensions: {
				length: 40,
				width: 30,
				height: 20
			}
		});
	}

	// Delicate items package (laser tubes)
	if (delicateItems.length > 0) {
		const totalValue = delicateItems.reduce((sum, item) => {
			const price = item.variant ? item.variant.price : item.product.base_price;
			return sum + (price * item.quantity);
		}, 0);

		packages.push({
			content: 'Tubos láser (frágil)',
			amount: delicateItems.reduce((sum, item) => sum + item.quantity, 0),
			type: 'box',
			weight: delicateItems.length * 2, // Estimate 2kg per tube
			insurance: totalValue * 0.2, // 20% insurance for delicate
			declaredValue: totalValue,
			weightUnit: 'KG',
			lengthUnit: 'CM',
			dimensions: {
				length: 120,
				width: 15,
				height: 15
			}
		});
	}

	// Heavy items - each gets its own package
	heavyItems.forEach(item => {
		const price = item.variant ? item.variant.price : item.product.base_price;
		
		packages.push({
			content: item.product.name,
			amount: 1,
			type: 'pallet',
			weight: 50, // Minimum weight for heavy items
			insurance: price * 0.15,
			declaredValue: price,
			weightUnit: 'KG',
			lengthUnit: 'CM',
			dimensions: {
				length: 100,
				width: 80,
				height: 80
			}
		});
	});

	return packages;
}

/**
 * Get company origin address (Guerra Laser México)
 */
export function getOriginAddress(): EnviaAddress {
	return {
		name: 'Guerra Laser México',
		company: 'Guerra Laser México',
		email: 'contacto@guerralaser.com',
		phone: '3320152372', // Update with real phone
		street: 'Av. Las torres 5301', // Update with real address
		city: 'Zapopan',
		state: 'Jalisco',
		country: 'MX',
		postalCode: '45010' // Update with real postal code
	};
}
