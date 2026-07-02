function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function applyInlineMarkdown(text: string): string {
	return text
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/__(.+?)__/g, '<strong>$1</strong>')
		.replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function renderProductText(text: string): string {
	if (!text?.trim()) return '';

	const lines = escapeHtml(text).split('\n');
	const blocks: string[] = [];
	let listItems: string[] = [];

	function flushList() {
		if (listItems.length === 0) return;
		blocks.push(`<ul>${listItems.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join('')}</ul>`);
		listItems = [];
	}

	for (const line of lines) {
		const trimmed = line.trim();

		if (!trimmed) {
			flushList();
			continue;
		}

		const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
		if (listMatch) {
			listItems.push(listMatch[1]);
			continue;
		}

		flushList();

		const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
		if (headingMatch) {
			const level = headingMatch[1].length;
			blocks.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`);
			continue;
		}

		blocks.push(`<p>${applyInlineMarkdown(trimmed)}</p>`);
	}

	flushList();
	return blocks.join('');
}
