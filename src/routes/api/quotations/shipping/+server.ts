import { json, type RequestHandler } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabaseServer';

interface QuotationRequestPayload {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zip?: string;
    country?: string;
  };
  items: any[];
  estimatedSubtotal?: number;
  estimatedTax?: number;
  notes?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const payload: QuotationRequestPayload = await request.json();

    // Validate required fields
    if (!payload.customerName || !payload.customerEmail || !payload.deliveryAddress) {
      return json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!payload.items || payload.items.length === 0) {
      return json(
        { error: 'Cart cannot be empty' },
        { status: 400 }
      );
    }

    // Get current user ID (if authenticated)
    const userId = locals.session?.user?.id;

    // Insert quotation request into database
    const { data, error } = await supabaseServer.client
      .from('quotation_requests')
      .insert([
        {
          user_id: userId || null,
          customer_name: payload.customerName,
          customer_email: payload.customerEmail,
          customer_phone: payload.customerPhone || null,
          delivery_address_street: payload.deliveryAddress.street,
          delivery_address_city: payload.deliveryAddress.city,
          delivery_address_state: payload.deliveryAddress.state,
          delivery_address_zip: payload.deliveryAddress.zip || null,
          delivery_address_country: payload.deliveryAddress.country || 'MX',
          items: payload.items,
          estimated_subtotal: payload.estimatedSubtotal || null,
          estimated_tax: payload.estimatedTax || null,
          notes: payload.notes || null,
          status: 'pending'
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return json(
        { error: 'Failed to create quotation request' },
        { status: 500 }
      );
    }

    // TODO: Send email notification to admin/sales team
    // await sendQuotationNotificationEmail({
    //   quotationId: data.id,
    //   customer: {
    //     name: payload.customerName,
    //     email: payload.customerEmail,
    //     phone: payload.customerPhone
    //   },
    //   items: payload.items,
    //   deliveryAddress: payload.deliveryAddress
    // });

    return json({
      success: true,
      quotationId: data.id,
      message: 'Solicitud de cotización recibida. Nos contactaremos en menos de 30 minutos.'
    });
  } catch (error) {
    console.error('Error creating quotation request:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};

/**
 * GET endpoint to retrieve quotation requests
 * Only accessible to authenticated users viewing their own quotations or admins
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    if (!locals.session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quotationId = url.searchParams.get('id');

    let query = supabaseServer.client
      .from('quotation_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // If quotationId is provided, fetch specific quotation
    if (quotationId) {
      query = query.eq('id', quotationId);
      const { data, error } = await query.single();
      
      if (error || !data) {
        return json({ error: 'Quotation not found' }, { status: 404 });
      }

      // Check authorization
      if (data.user_id !== locals.session.user.id && !isAdmin(locals.session.user)) {
        return json({ error: 'Unauthorized' }, { status: 403 });
      }

      return json(data);
    }

    // Otherwise, fetch user's quotations
    const { data, error } = await query
      .eq('user_id', locals.session.user.id)
      .limit(50);

    if (error) {
      console.error('Database error:', error);
      return json({ error: 'Failed to fetch quotations' }, { status: 500 });
    }

    return json(data);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

function isAdmin(user: any): boolean {
  // TODO: Implement proper admin check based on your roles system
  return user?.role === 'admin';
}
