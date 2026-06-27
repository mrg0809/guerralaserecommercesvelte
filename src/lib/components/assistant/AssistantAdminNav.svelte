<script lang="ts">
	import { page } from '$app/stores';

	const links = [
		{ href: '/admin/asistente', label: 'Chat' },
		{ href: '/admin/asistente/conocimiento', label: 'Conocimiento' },
		{ href: '/admin/asistente/temas', label: 'Temas' },
		{ href: '/admin/asistente/equipo', label: 'Equipo' },
		{ href: '/admin/asistente/dispositivos', label: 'Dispositivos' }
	];
</script>

<nav class="flex flex-wrap gap-2 px-4 py-2 border-b border-[var(--as-border,#3c4043)] bg-[#1e1f20]">
	{#each links as link}
		<a
			href={link.href}
			class="text-sm px-3 py-1 rounded-full border border-[var(--as-border,#3c4043)] text-[#9aa0a6] hover:text-[#e3e3e3] {$page.url.pathname === link.href ? 'bg-[#282a2c] text-[#8ab4f8] border-[#8ab4f8]' : ''}"
		>
			{link.label}
		</a>
	{/each}
</nav>
