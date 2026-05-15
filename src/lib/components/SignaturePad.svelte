<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import SignaturePad from 'signature_pad';

	let {
		onConfirm = () => {},
		height = 220
	}: {
		onConfirm?: (dataUrl: string) => void;
		height?: number;
	} = $props();

	let canvasEl: HTMLCanvasElement;
	let pad: SignaturePad | null = null;

	onMount(() => {
		const resize = () => {
			if (!canvasEl) return;
			const ratio = Math.max(window.devicePixelRatio || 1, 1);
			const rect = canvasEl.getBoundingClientRect();
			canvasEl.width = rect.width * ratio;
			canvasEl.height = rect.height * ratio;
			const ctx = canvasEl.getContext('2d');
			if (ctx) ctx.scale(ratio, ratio);
			pad?.clear();
		};

		pad = new SignaturePad(canvasEl, {
			backgroundColor: 'rgb(255, 255, 255)',
			penColor: 'rgb(0, 0, 0)'
		});

		resize();
		window.addEventListener('resize', resize);
		return () => window.removeEventListener('resize', resize);
	});

	onDestroy(() => {
		pad?.off();
	});

	function clearPad() {
		pad?.clear();
	}

	function confirm() {
		if (!pad || pad.isEmpty()) {
			alert('Por favor firme en el recuadro antes de confirmar.');
			return;
		}
		onConfirm(pad.toDataURL('image/png'));
	}
</script>

<div class="signature-pad-wrapper">
	<canvas
		bind:this={canvasEl}
		class="w-full border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none"
		style="height: {height}px; touch-action: none;"
	></canvas>
	<div class="flex gap-3 mt-3">
		<button
			type="button"
			class="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium"
			onclick={clearPad}
		>
			Limpiar
		</button>
		<button
			type="button"
			class="flex-1 py-3 rounded-lg bg-blue-600 text-white font-medium"
			onclick={confirm}
		>
			Confirmar firma
		</button>
	</div>
</div>
