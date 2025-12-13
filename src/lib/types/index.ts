import type { Database } from './database.types';

export type Category = Database['public']['Tables']['categories']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type ProductVariant = Database['public']['Tables']['product_variants']['Row'];
export type ProductMedia = Database['public']['Tables']['product_media']['Row'];
export type Discount = Database['public']['Tables']['discounts']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];

export interface CartItem {
	product: Product;
	variant?: ProductVariant;
	quantity: number;
	media?: ProductMedia[];
}

export interface ProductWithDetails extends Product {
	category?: Category;
	variants?: ProductVariant[];
	media?: ProductMedia[];
	discounts?: Discount[];
}
