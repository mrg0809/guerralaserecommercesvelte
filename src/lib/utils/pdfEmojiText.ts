import type { jsPDF } from 'jspdf';

const EMOJI_RE = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
const twemojiCache = new Map<string, string>();

type Segment = { kind: 'text'; value: string } | { kind: 'emoji'; value: string };

export function textContainsEmoji(text: string): boolean {
	EMOJI_RE.lastIndex = 0;
	return EMOJI_RE.test(text);
}

export function segmentTextWithEmoji(text: string): Segment[] {
	const segments: Segment[] = [];
	let lastIndex = 0;
	EMOJI_RE.lastIndex = 0;

	for (const match of text.matchAll(EMOJI_RE)) {
		const start = match.index ?? 0;
		if (start > lastIndex) {
			segments.push({ kind: 'text', value: text.slice(lastIndex, start) });
		}
		segments.push({ kind: 'emoji', value: match[0] });
		lastIndex = start + match[0].length;
	}

	if (lastIndex < text.length) {
		segments.push({ kind: 'text', value: text.slice(lastIndex) });
	}

	return segments.length ? segments : [{ kind: 'text', value: text }];
}

function tokenizeForWrap(text: string): Segment[] {
	const tokens: Segment[] = [];
	for (const segment of segmentTextWithEmoji(text)) {
		if (segment.kind === 'emoji') {
			tokens.push(segment);
			continue;
		}
		const parts = segment.value.split(/(\s+)/);
		for (const part of parts) {
			if (part) tokens.push({ kind: 'text', value: part });
		}
	}
	return tokens;
}

function emojiSizeMm(doc: jsPDF): number {
	return (doc.getFontSize() * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
}

export function getPdfLineHeightMm(doc: jsPDF, multiplier = 1.08): number {
	return emojiSizeMm(doc) * multiplier;
}

function measureTokenWidth(doc: jsPDF, token: Segment, emojiSize: number): number {
	if (token.kind === 'emoji') return emojiSize;
	return doc.getTextWidth(token.value);
}

function tokensToString(tokens: Segment[]): string {
	return tokens.map((t) => t.value).join('');
}

function emojiToTwemojiCode(emoji: string): string {
	return [...emoji]
		.map((char) => char.codePointAt(0)?.toString(16))
		.filter((cp): cp is string => Boolean(cp) && cp !== 'fe0f')
		.join('-');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(buffer).toString('base64');
	}
	const bytes = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

async function getTwemojiDataUrl(emoji: string): Promise<string | null> {
	if (twemojiCache.has(emoji)) return twemojiCache.get(emoji)!;

	const code = emojiToTwemojiCode(emoji);
	const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code}.png`;

	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const buffer = await res.arrayBuffer();
		const dataUrl = `data:image/png;base64,${arrayBufferToBase64(buffer)}`;
		twemojiCache.set(emoji, dataUrl);
		return dataUrl;
	} catch {
		return null;
	}
}

export async function wrapPdfText(doc: jsPDF, text: string, maxWidthMm: number): Promise<string[]> {
	const normalized = (text ?? '').replace(/\r\n/g, '\n');
	const paragraphs = normalized.split('\n');
	const lines: string[] = [];

	for (const paragraph of paragraphs) {
		if (!paragraph.trim()) {
			lines.push('');
			continue;
		}

		if (!textContainsEmoji(paragraph)) {
			lines.push(...doc.splitTextToSize(paragraph, maxWidthMm));
			continue;
		}

		const tokens = tokenizeForWrap(paragraph);
		const emojiSize = emojiSizeMm(doc);
		let currentTokens: Segment[] = [];
		let currentWidth = 0;

		for (const token of tokens) {
			const tokenWidth = measureTokenWidth(doc, token, emojiSize);
			if (currentWidth + tokenWidth > maxWidthMm && currentTokens.length > 0) {
				lines.push(tokensToString(currentTokens));
				currentTokens = [token];
				currentWidth = tokenWidth;
			} else {
				currentTokens.push(token);
				currentWidth += tokenWidth;
			}
		}

		if (currentTokens.length) {
			lines.push(tokensToString(currentTokens));
		}
	}

	return lines.length ? lines : [''];
}

export async function drawPdfLineWithEmoji(
	doc: jsPDF,
	line: string,
	x: number,
	y: number
): Promise<void> {
	if (!textContainsEmoji(line)) {
		doc.text(line, x, y);
		return;
	}

	const emojiSize = emojiSizeMm(doc);
	let cursorX = x;

	for (const segment of segmentTextWithEmoji(line)) {
		if (segment.kind === 'text') {
			doc.text(segment.value, cursorX, y);
			cursorX += doc.getTextWidth(segment.value);
			continue;
		}

		const dataUrl = await getTwemojiDataUrl(segment.value);
		if (dataUrl) {
			doc.addImage(dataUrl, 'PNG', cursorX, y - emojiSize * 0.82, emojiSize, emojiSize);
			cursorX += emojiSize;
		}
	}
}

export async function drawPdfTextBlock(
	doc: jsPDF,
	text: string,
	x: number,
	y: number,
	maxWidthMm: number,
	opts?: {
		pageBottom?: number;
		pageTop?: number;
		lineHeightMultiplier?: number;
		onNewPage?: () => void;
	}
): Promise<number> {
	const lineHeight = getPdfLineHeightMm(doc, opts?.lineHeightMultiplier ?? 1.08);
	const pageBottom = opts?.pageBottom ?? 270;
	const pageTop = opts?.pageTop ?? 20;
	const lines = await wrapPdfText(doc, text.trim(), maxWidthMm);
	let currentY = y;

	for (const line of lines) {
		if (currentY + lineHeight > pageBottom) {
			doc.addPage();
			opts?.onNewPage?.();
			currentY = pageTop;
		}
		await drawPdfLineWithEmoji(doc, line, x, currentY);
		currentY += lineHeight;
	}

	return currentY;
}
