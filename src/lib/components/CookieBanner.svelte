<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let showBanner = $state(false);

	onMount(() => {
		// Verificar si el usuario ya aceptó las cookies
		const cookiesAccepted = localStorage.getItem('cookiesAccepted');
		if (!cookiesAccepted) {
			showBanner = true;
		}
	});

	function acceptCookies() {
		if (browser) {
			localStorage.setItem('cookiesAccepted', 'true');
			showBanner = false;
			
			// Emitir evento para que otros componentes sepan que se aceptaron las cookies
			window.dispatchEvent(new CustomEvent('cookiesAccepted'));
		}
	}
</script>

{#if showBanner}
	<div class="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
		<div class="container mx-auto px-4 py-3 sm:py-4">
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
				<p class="text-sm text-gray-700 leading-relaxed">
					Usamos cookies para mejorar tu experiencia y mostrarte publicidad personalizada. 
					Al continuar navegando, aceptas nuestro 
					<a href="/privacidad" class="text-blue-600 hover:text-blue-700 underline font-medium">
						Aviso de Privacidad
					</a>.
				</p>
				<button
					onclick={acceptCookies}
					class="whitespace-nowrap px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex-shrink-0"
				>
					Aceptar
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Animación suave de entrada */
	div {
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>
