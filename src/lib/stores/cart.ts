import { writable } from 'svelte/store';
import type { CartItem } from '$lib/types';

function createCartStore() {
	const { subscribe, set, update } = writable<CartItem[]>([]);

	// Load cart from localStorage if available
	if (typeof window !== 'undefined') {
		const stored = localStorage.getItem('cart');
		if (stored) {
			set(JSON.parse(stored));
		}
	}

	return {
		subscribe,
		addItem: (item: CartItem) =>
			update((items) => {
				const existingIndex = items.findIndex(
					(i) =>
						i.product.id === item.product.id &&
						(!item.variant || i.variant?.id === item.variant?.id)
				);

				if (existingIndex >= 0) {
					items[existingIndex].quantity += item.quantity;
				} else {
					items.push(item);
				}

				if (typeof window !== 'undefined') {
					localStorage.setItem('cart', JSON.stringify(items));
				}

				return items;
			}),
		removeItem: (productId: string, variantId?: string) =>
			update((items) => {
				const filtered = items.filter(
					(i) =>
						!(i.product.id === productId && (!variantId || i.variant?.id === variantId))
				);

				if (typeof window !== 'undefined') {
					localStorage.setItem('cart', JSON.stringify(filtered));
				}

				return filtered;
			}),
		updateQuantity: (productId: string, quantity: number, variantId?: string) =>
			update((items) => {
				const item = items.find(
					(i) =>
						i.product.id === productId && (!variantId || i.variant?.id === variantId)
				);

				if (item) {
					item.quantity = quantity;
				}

				if (typeof window !== 'undefined') {
					localStorage.setItem('cart', JSON.stringify(items));
				}

				return items;
			}),
		clear: () => {
			set([]);
			if (typeof window !== 'undefined') {
				localStorage.removeItem('cart');
			}
		}
	};
}

export const cart = createCartStore();
