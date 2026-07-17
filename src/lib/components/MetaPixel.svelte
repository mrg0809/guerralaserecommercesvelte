<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	const PIXEL_ID = '3858982667705556';

	onMount(() => {
		if (!browser) return;

		const cookiesAccepted = localStorage.getItem('cookiesAccepted');

		if (cookiesAccepted === 'true') {
			scheduleMetaPixel();
		} else {
			window.addEventListener('cookiesAccepted', scheduleMetaPixel);
		}

		return () => {
			window.removeEventListener('cookiesAccepted', scheduleMetaPixel);
		};
	});

	function scheduleMetaPixel() {
		const run = () => loadMetaPixel();
		if ('requestIdleCallback' in window) {
			requestIdleCallback(run, { timeout: 5000 });
		} else {
			window.addEventListener('load', run, { once: true });
		}
	}

	function loadMetaPixel() {
		if (!browser || (window as any).fbq) return;

		(function (f: any, b: any, e: string, v: string, n: any, t: any, s: any) {
			if (f.fbq) return;
			n = f.fbq = function () {
				n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
			};
			if (!f._fbq) f._fbq = n;
			n.push = n;
			n.loaded = true;
			n.version = '2.0';
			n.queue = [];
			t = b.createElement(e);
			t.async = true;
			t.src = v;
			s = b.getElementsByTagName(e)[0];
			s.parentNode.insertBefore(t, s);
		})(
			window,
			document,
			'script',
			'https://connect.facebook.net/en_US/fbevents.js',
			null,
			null,
			null
		);

		(window as any).fbq('init', PIXEL_ID);
		(window as any).fbq('track', 'PageView');
	}
</script>

<svelte:head>
	{#if typeof window !== 'undefined' && localStorage.getItem('cookiesAccepted') === 'true'}
		<noscript>
			<img
				height="1"
				width="1"
				style="display:none"
				src="https://www.facebook.com/tr?id={PIXEL_ID}&ev=PageView&noscript=1"
				alt=""
			/>
		</noscript>
	{/if}
</svelte:head>
