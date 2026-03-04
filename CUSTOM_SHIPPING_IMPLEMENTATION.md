# Custom Shipping System Implementation

## Overview
This document summarizes the complete migration from Envia.com API-based shipping to a custom, database-driven shipping system. The new system uses predefined shipping types associated with products, providing fixed pricing and simplified checkout flow.

## Why Custom Shipping?
- **Simpler**: No complex external API integration
- **Flexible**: Define exact shipping options per product
- **Cost Control**: Fixed prices align with your business model ($250 FedEx, $350 FedEx Express, $700 heavy, etc.)
- **Reliability**: Database-driven = no API timeouts or token issues

## Completed Implementation

### 1. Database Migration ✅
**File**: `database/migrations/20260304000000_custom_shipping_types.sql`

**What it creates:**
- `shipping_types` table with columns:
  - `id` (UUID primary key)
  - `name` (unique name like "FedEx Standard")
  - `description` (UI display text)
  - `carrier` ("fedex", "dhl", "estafeta", etc.)
  - `service` ("standard", "express", "heavy", etc.)
  - `base_price` (decimal, your fixed price)
  - `estimated_days` (delivery estimate)
  - `is_active` (toggle on/off)
  - `display_order` (sort order in UI)

**Default Shipping Types Created:**
1. **FedEx Standard** - $250, 2-3 days
2. **FedEx Express** - $350, next day
3. **Envío Pesado** - $700, 5 days (for heavy equipment)
4. **Cotización Personalizada** - $0 (for machinery requiring manual quotes)

**Product Relationship:**
- Added `shipping_type_id` FK to `products` table
- Each product can reference one shipping type
- Products without assigned type default to first option

**RLS Policies:**
- Public can read shipping types
- Only admins can create/modify/delete

### 2. Shipping Service Layer ✅
**File**: `src/lib/services/shippingService.ts`

**Key Functions:**

#### `getShippingOptionsForCart(cartItems)`
- Returns available shipping options for items in cart
- Queries DB for shipping types linked to products
- Automatically includes "Cotización Personalizada" if any item requires quotation
- **No external API calls**

#### `cartRequiresQuotation(cartItems)`
- Returns `true` if cart contains items flagged for quotation
- Used to show quotation modal instead of shipping options

#### `getCheckoutButtonLabel(cartItems)`
- Returns appropriate button text based on cart
- "Solicitar Cotización de Envío" or "Proceder al Pago"

#### `calculateShippingCost(cartItems, selectedShippingType)`
- Returns fixed price from selected shipping type
- Simple calculation (future: could be qty-based)

### 3. API Endpoint (Completely Rewritten) ✅
**File**: `src/routes/api/shipping/quote/+server.ts`

**Changes:**
- ✅ **REMOVED**: All Envia.com imports and logic
- ✅ **REMOVED**: Address conversion, package weight calculations
- ✅ **ADDED**: Direct `getShippingOptionsForCart()` call
- ✅ **ADDED**: Simple response mapping

**Request Format:**
```json
{
  "cartItems": [...]
}
```

**Response Format:**
```json
{
  "success": true,
  "options": [
    {
      "id": "uuid",
      "name": "FedEx Standard",
      "description": "Entrega en 2-3 días hábiles",
      "carrier": "fedex",
      "service": "standard",
      "price": 250,
      "estimatedDays": 3
    }
  ]
}
```

### 4. Checkout Page Refactoring ✅
**File**: `src/routes/checkout/+page.svelte`

**Updates Made:**

#### Script Section:
- ✅ Changed imports from `shippingResolver` to `shippingService`
- ✅ Renamed state variables:
  - `loadingShippingRates` → `loadingShippingOptions`
  - `shippingRates` → `shippingOptions`
  - `selectedShippingRate` → `selectedShippingOption`
- ✅ Removed `shippingType` (no longer needed)
- ✅ Simplified `loadShippingRates()` → `loadShippingOptions()`
  - No destination/customer address required
  - Just sends cart items
  - Gets back shipping type options immediately

#### Form Section:
- ✅ Removed address requirement validation for shipping query
- ✅ Renamed button from "loadShippingRates" to "loadShippingOptions"
- ✅ Updated shipping options loop:
  - Changed from `shippingRates` to `shippingOptions`
  - Updated property bindings: `rate.*` → `option.*`
  - Shows `option.carrier`, `option.service`, `option.description`
- ✅ Updated submit button text logic
- ✅ Simplified payment section condition

#### Payment Section:
- ✅ Condition now checks `selectedShippingOption` instead of `selectedShippingRate`
- ✅ Submit button disabled until shipping option selected
- ✅ Removed automatic shipping label generation (will be done separately)

### 5. Order Submission ✅
**Updated `submitOrder()` Function:**
- Saves `shipping_carrier` and `shipping_service` to order record
- Pulled from `selectedShippingOption` properties
- No longer calls `/api/shipping/create` for labels (can be added later)
- Cleaner, faster checkout flow

## Next Steps

### CRITICAL: Execute Database Migration
1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy entire contents of `database/migrations/20260304000000_custom_shipping_types.sql`
4. Paste into editor
5. Click "Execute"
6. Verify tables created: `shipping_types` table should exist with 4 default rows

### Assign Shipping Types to Products
Once migration runs, you need to assign shipping types to existing products:

```sql
-- FedEx Standard (most products)
UPDATE products 
SET shipping_type_id = (SELECT id FROM shipping_types WHERE name = 'FedEx Standard')
WHERE product_category IN ('lasers', 'consumibles', 'accesorios');

-- Heavy equipment (chillers, compressors, extractors)
UPDATE products 
SET shipping_type_id = (SELECT id FROM shipping_types WHERE name = 'Envío Pesado')
WHERE product_category IN ('enfriamiento', 'compresion', 'extraccion');

-- Quotation required (machinery)
UPDATE products 
SET shipping_type_id = (SELECT id FROM shipping_types WHERE name = 'Cotización Personalizada')
WHERE requires_quotation = true;
```

Or use Supabase UI to manually update products.

### Test Checkout Flow
1. Add products to cart
2. Go to `/checkout`
3. Click "Consultar Opciones de Envío"
4. Verify shipping options appear (no address fields required!)
5. Select shipping option
6. Payment button should enable
7. Complete Stripe payment flow

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│     Checkout Page (SVG UI)              │
│  - Cart items display                   │
│  - Customer info form                   │
│  - "Consultar Opciones de Envío" button │
└──────────────┬──────────────────────────┘
               │
               ▼
       ┌───────────────────┐
       │ loadShippingOptions│
       │ (no address needed)│
       └─────────┬─────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │ /api/shipping/quote (POST)  │
    │ - Receives: { cartItems }   │
    │ - Returns: { options: [] }  │
    └──────────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────────────┐
    │ shippingService.ts               │
    │ - getShippingOptionsForCart()   │
    │ - cartRequiresQuotation()       │
    └──────────────┬────────────────────┘
               │
               ▼
    ┌──────────────────────────────────┐
    │      Supabase Database            │
    │  ┌──────────────────────────────┐ │
    │  │  shipping_types table         │ │
    │  │  - id, name, carrier, price   │ │
    │  └───────────┬────────────────────┤ │
    │              │                     │ │
    │              └──→ products.shipping_type_id
    │                                   │ │
    │  ┌──────────────────────────────┐ │ │
    │  │  products table               │ │ │
    │  │  - id, name, shipping_type_id │ │ │
    │  └──────────────────────────────┘ │ │
    │                                   │ │
    │  ┌──────────────────────────────┐ │ │
    │  │  orders table                 │ │ │
    │  │  - shipping_carrier           │ │ │
    │  │  - shipping_service           │ │ │
    │  │  - shipping_amount            │ │ │
    │  └──────────────────────────────┘ │ │
    └──────────────────────────────────────┘
```

## Configuration Variables

No new environment variables needed! System uses:
- Existing `VITE_STRIPE_PUBLISHABLE_KEY` for payments
- Existing Supabase client connection

## Shipping Types Reference

| Name | Carrier | Service | Price | Days | Use Case |
|------|---------|---------|-------|------|----------|
| FedEx Standard | fedex | standard | $250 | 2-3 | Lasers, parts, small items |
| FedEx Express | fedex | express | $350 | 1 | Rush orders |
| Envío Pesado | fedex | heavy | $700 | 5 | Chillers, compressors, equipment |
| Cotización Personalizada | - | - | $0 | - | Machinery (quotes via email) |

### Adding New Shipping Types

Once database is set up, add new types via Supabase SQL:

```sql
INSERT INTO shipping_types (name, description, carrier, service, base_price, estimated_days, display_order)
VALUES 
  ('Estafeta Express', 'Entrega Estafeta rápida', 'estafeta', 'express', 300, 1, 3),
  ('DHL Premium', 'DHL para entregas especiales', 'dhl', 'premium', 450, 2, 4);
```

## Removed/Deprecated Components

The following Envia.com components are NO LONGER USED:
- ❌ `src/lib/services/enviaService.ts`
- ❌ `/api/shipping/create` endpoint
- ❌ `/api/shipping/track` endpoint
- ❌ `/test-envia` page
- ❌ `ENVIA_DEBUGGING_GUIDE.md`
- ❌ `ENVIA_FIX_SUMMARY.md`
- ❌ `ENVIA_STRIPE_INTEGRATION.md`

These can be deleted to clean up codebase.

## File Summary

| File | Status | Purpose |
|------|--------|---------|
| `database/migrations/20260304000000_custom_shipping_types.sql` | ✅ Ready | Creates shipping_types table, indexes, policies, and default data |
| `src/lib/services/shippingService.ts` | ✅ Complete | Core shipping logic without external APIs |
| `src/routes/api/shipping/quote/+server.ts` | ✅ Complete | API endpoint returning shipping options |
| `src/routes/checkout/+page.svelte` | ✅ Complete | Refactored checkout with new shipping variables/logic |

## Troubleshooting

### "No shipping options appear after clicking button"
- Check database migration executed in Supabase
- Verify `shipping_types` table exists with 4 rows
- Check that products have valid `shipping_type_id` values (not NULL)

### "Selected shipping option shows as undefined"
- Verify `selectedShippingOption` state variable initialized
- Check API response includes all required fields: `id`, `name`, `carrier`, `service`, `price`, `estimatedDays`

### "Button stays disabled"
- Check that at least one shipping option was returned from API
- Verify `selectedShippingOption` is properly assigned when option clicked
- Check form state bindings are working

## Future Enhancements

1. **Shipping Label Generation** - Integrate with carrier APIs to auto-generate labels after payment
2. **Address-Based Pricing** - Vary shipping prices based on destination state/zone
3. **Admin Dashboard** - UI to manage shipping types and product assignments
4. **Weight-Based Pricing** - Calculate shipping based on product weight
5. **International Shipping** - Support shipping outside Mexico
6. **Quotation Workflow** - Automated email system for machinery quotations

