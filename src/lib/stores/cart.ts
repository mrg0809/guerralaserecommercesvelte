import { writable } from 'svelte/store';
import type { CartItem } from '$lib/types';

function acrylicCutKey(item: CartItem): string {
	if (!item.acrylicCut) return '';
	const c = item.acrylicCut;
	return `${c.size_id}:${c.width_cm}x${c.height_cm}:${c.unit_price}`;
}

function sameLine(a: CartItem, b: CartItem): boolean {
	return (
		a.product.id === b.product.id &&
		(!b.variant || a.variant?.id === b.variant?.id) &&
		(!b.bundle || a.bundle?.id === b.bundle?.id) &&
		acrylicCutKey(a) === acrylicCutKey(b)
	);
}

function createCartStore() {
	const { subscribe, set, update } = writable<CartItem[]>([]);

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
				const existingIndex = items.findIndex((i) => sameLine(i, item));

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
		removeItem: (productId: string, variantId?: string, bundleId?: string, acrylicCutKeyStr?: string) =>
			update((items) => {
				const filtered = items.filter((i) => {
					const matchProduct =
						i.product.id === productId &&
						(!variantId || i.variant?.id === variantId) &&
						(!bundleId || i.bundle?.id === bundleId);
					if (!matchProduct) return true;
					if (acrylicCutKeyStr !== undefined) {
						return acrylicCutKey(i) !== acrylicCutKeyStr;
					}
					return false;
				});

				if (typeof window !== 'undefined') {
					localStorage.setItem('cart', JSON.stringify(filtered));
				}

				return filtered;
			}),
		updateQuantity: (
			productId: string,
			quantity: number,
			variantId?: string,
			bundleId?: string,
			acrylicCutKeyStr?: string
		) =>
			update((items) => {
				const item = items.find((i) => {
					const matchProduct =
						i.product.id === productId &&
						(!variantId || i.variant?.id === variantId) &&
						(!bundleId || i.bundle?.id === bundleId);
					if (!matchProduct) return false;
					if (acrylicCutKeyStr !== undefined) {
						return acrylicCutKey(i) === acrylicCutKeyStr;
					}
					return !i.acrylicCut;
				});

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
export { acrylicCutKey };
