export const LASER_FONTS = [
	{ id: 'Roboto', family: 'Roboto', weights: '400;700' },
	{ id: 'Oswald', family: 'Oswald', weights: '400;700' },
	{ id: 'Montserrat', family: 'Montserrat', weights: '400;700' },
	{ id: 'Bebas Neue', family: 'Bebas Neue', weights: '400' },
	{ id: 'Anton', family: 'Anton', weights: '400' },
	{ id: 'Raleway', family: 'Raleway', weights: '400;700' },
	{ id: 'Lato', family: 'Lato', weights: '400;700' },
	{ id: 'Poppins', family: 'Poppins', weights: '400;700' },
	{ id: 'Barlow Condensed', family: 'Barlow Condensed', weights: '400;700' },
	{ id: 'Inter', family: 'Inter', weights: '400;700' }
] as const;

const loaded = new Set<string>();

export async function loadLaserFont(family: string): Promise<void> {
	if (loaded.has(family) || typeof document === 'undefined') return;

	const font = LASER_FONTS.find((f) => f.family === family) ?? LASER_FONTS[0];
	const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family)}:wght@${font.weights}&display=swap`;

	if (!document.querySelector(`link[data-laser-font="${font.family}"]`)) {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = href;
		link.setAttribute('data-laser-font', font.family);
		document.head.appendChild(link);
	}

	await document.fonts.load(`16px "${font.family}"`);
	loaded.add(family);
}

export async function loadAllLaserFonts(): Promise<void> {
	await Promise.all(LASER_FONTS.map((f) => loadLaserFont(f.family)));
}
