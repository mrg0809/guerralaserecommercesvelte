// Shipping resolver service for detecting heavy items and determining shipping type
import type { CartItem } from './cart';

export interface ShippingOption {
  id: string;
  name: string;
  carrier: string;
  description: string;
  price: number;
  estimatedDays?: number;
}

export interface ShippingResolution {
  shippingTypeId: string;
  shippingTypeName: 'standard' | 'delicate' | 'heavy';
  requiresQuotation: boolean;
  requiresSpecialHandling: boolean;
  availableMethods: ShippingOption[];
  totalEstimatedShipping: number;
}

/**
 * Detect the shipping type based on cart items
 * If ANY item has 'heavy' shipping type, the entire cart requires quotation
 * This is the key business rule
 */
export function detectShippingType(cartItems: CartItem[]): 'standard' | 'delicate' | 'heavy' | null {
  // Check if any item is heavy (machinery, chillers, compressors, extractors)
  const hasHeavyItem = cartItems.some(item => item.shipping_type_name === 'heavy');
  if (hasHeavyItem) return 'heavy';

  // Check if any item is delicate (laser tubes)
  const hasDelicateItem = cartItems.some(item => item.shipping_type_name === 'delicate');
  if (hasDelicateItem) return 'delicate';

  // Default to standard
  return 'standard';
}

/**
 * Check if cart contains any heavy items that require quotation
 */
export function cartRequiresShippingQuotation(cartItems: CartItem[]): boolean {
  return cartItems.some(item => item.shipping_type_name === 'heavy');
}

/**
 * Resolve shipping options based on cart items and destination
 * This function should be called from the checkout page to populate shipping options
 */
export async function resolveShippingOptions(
  cartItems: CartItem[],
  destination?: {
    city?: string;
    state?: string;
    country?: string;
  }
): Promise<ShippingResolution | null> {
  try {
    // Detect shipping type from cart
    const shippingType = detectShippingType(cartItems);
    if (!shippingType) return null;

    // Fetch available shipping methods for this type from database
    const response = await fetch('/api/shipping/methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shippingType, destination })
    });

    if (!response.ok) throw new Error('Failed to fetch shipping methods');

    return await response.json();
  } catch (error) {
    console.error('Error resolving shipping options:', error);
    return null;
  }
}

/**
 * Get shipping method label for UI display
 */
export function getShippingLabel(shippingType: 'standard' | 'delicate' | 'heavy' | null): string {
  switch (shippingType) {
    case 'heavy':
      return 'Envío a Cotizar';
    case 'delicate':
      return 'Envío Especial';
    case 'standard':
      return 'Envío Estándar';
    default:
      return 'Envío';
  }
}

/**
 * Get button label for heavy items
 */
export function getCheckoutButtonLabel(shippingType: 'standard' | 'delicate' | 'heavy' | null): string {
  if (shippingType === 'heavy') {
    return 'Cotizar Envío';
  }
  return 'Comprar';
}
