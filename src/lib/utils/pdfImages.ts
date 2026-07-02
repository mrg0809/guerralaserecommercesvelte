export async function loadImageForPdf(
	url: string
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
	if (!url) return null;

	try {
		const response = await fetch(url);
		if (!response.ok) return null;

		const blob = await response.blob();
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});

		const format: 'PNG' | 'JPEG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
		return { dataUrl, format };
	} catch {
		return null;
	}
}
