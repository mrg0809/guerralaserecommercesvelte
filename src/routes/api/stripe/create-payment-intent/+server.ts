import { json, type RequestHandler } from '@sveltejs/kit';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { amount, currency, description, metadata } = await request.json();

    // Validate required fields
    if (!amount || !currency) {
      return json(
        { error: 'Missing required fields: amount, currency' },
        { status: 400 }
      );
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency: currency.toLowerCase(),
      description,
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true
      }
    });

    return json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status
    });
  } catch (error: any) {
    console.error('Stripe error:', error);
    return json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    );
  }
};
