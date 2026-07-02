import { getImageKitUrl } from '$lib/storage';

type ProductMedia = {
	url?: string | null;
	is_primary?: boolean | null;
	display_order?: number | null;
};

export function getPrimaryProductImageUrl(
	media: ProductMedia[] | null | undefined
): string {
	if (!media?.length) return '';

	const sorted = [...media].sort((a, b) => {
		if (a.is_primary && !b.is_primary) return -1;
		if (!a.is_primary && b.is_primary) return 1;
		return (a.display_order ?? 0) - (b.display_order ?? 0);
	});

	return getImageKitUrl(sorted[0]?.url);
}
