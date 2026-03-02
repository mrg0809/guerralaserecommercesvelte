import { json, type RequestHandler } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabaseServer';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { shippingType, destination } = await request.json();

    // Fetch shipping type and its methods from database
    const { data, error } = await supabaseServer.client
      .from('shipping_types')
      .select(`
        id,
        name,
        description,
        requires_quotation,
        requires_special_handling,
        shipping_methods(
          id,
          name,
          carrier,
          description,
          base_price,
          display_order
        )
      `)
      .eq('name', shippingType)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Database error:', error);
      return json(
        { error: 'Failed to fetch shipping methods' },
        { status: 400 }
      );
    }

    if (!data) {
      return json(
        { error: 'Shipping type not found' },
        { status: 404 }
      );
    }

    // Transform shipping methods to match frontend expectations
    const availableMethods = (data.shipping_methods || [])
      .filter((method: any) => method) // Filter out nulls
      .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
      .map((method: any) => ({
        id: method.id,
        name: method.name,
        carrier: method.carrier,
        description: method.description,
        price: parseFloat(method.base_price),
        estimatedDays: getEstimatedDays(method.carrier)
      }));

    // Calculate total estimated shipping (use first available method or 0)
    const totalEstimatedShipping =
      availableMethods.length > 0 ? availableMethods[0].price : 0;

    return json({
      shippingTypeId: data.id,
      shippingTypeName: data.name,
      requiresQuotation: data.requires_quotation,
      requiresSpecialHandling: data.requires_special_handling,
      availableMethods,
      totalEstimatedShipping
    });
  } catch (error) {
    console.error('Error in shipping methods:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};

function getEstimatedDays(carrier: string): number {
  switch (carrier.toLowerCase()) {
    case 'fedex':
      return 3;
    case 'dhl':
      return 2;
    case 'local':
      return 5;
    default:
      return 5;
  }
}
