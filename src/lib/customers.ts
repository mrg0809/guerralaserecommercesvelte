export function formatCustomerAddress(customer: {
	street?: string | null;
	neighborhood?: string | null;
	city?: string | null;
	state?: string | null;
	zip_code?: string | null;
	country?: string | null;
}): string {
	return [
		customer.street,
		customer.neighborhood,
		[customer.city, customer.state].filter(Boolean).join(', '),
		customer.zip_code,
		customer.country || 'México'
	]
		.filter(Boolean)
		.join(', ');
}

export function getDeliveryPhotoPublicUrl(storagePath: string, supabaseUrl: string): string {
	return `${supabaseUrl}/storage/v1/object/public/delivery-photos/${storagePath}`;
}
