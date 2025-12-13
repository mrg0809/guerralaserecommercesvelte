<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { cart } from '$lib/stores/cart';
	import '../app.css';

	let { children } = $props();

	let cartItemCount = $state(0);
	cart.subscribe((items) => {
		cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen flex flex-col">
	<header class="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
		<nav class="container mx-auto px-4 py-4">
			<div class="flex items-center justify-between">
				<a href="/" class="text-2xl font-bold hover:opacity-80 transition-opacity">
					⚡ Guerra Láser
				</a>
				<div class="flex items-center gap-6">
					<a href="/" class="hover:opacity-80 transition-opacity">Inicio</a>
					<a href="/productos" class="hover:opacity-80 transition-opacity">Productos</a>
					<a href="/categorias" class="hover:opacity-80 transition-opacity">Categorías</a>
					<a href="/carrito" class="relative hover:opacity-80 transition-opacity">
						🛒 Carrito
						{#if cartItemCount > 0}
							<span
								class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
							>
								{cartItemCount}
							</span>
						{/if}
					</a>
					<a href="/admin" class="hover:opacity-80 transition-opacity">Admin</a>
				</div>
			</div>
		</nav>
	</header>

	<main class="flex-grow">
		{@render children()}
	</main>

	<footer class="bg-gray-800 text-white py-8 mt-12">
		<div class="container mx-auto px-4">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
				<div>
					<h3 class="text-xl font-bold mb-4">Guerra Láser</h3>
					<p class="text-gray-400">Máquinas de corte y grabado láser de alta precisión</p>
				</div>
				<div>
					<h4 class="font-bold mb-4">Enlaces</h4>
					<ul class="space-y-2 text-gray-400">
						<li><a href="/productos" class="hover:text-white">Productos</a></li>
						<li><a href="/categorias" class="hover:text-white">Categorías</a></li>
						<li><a href="/contacto" class="hover:text-white">Contacto</a></li>
					</ul>
				</div>
				<div>
					<h4 class="font-bold mb-4">Contacto</h4>
					<p class="text-gray-400">Email: contacto@guerralaser.com</p>
					<p class="text-gray-400">Teléfono: +52 55 1234 5678</p>
				</div>
			</div>
			<div class="mt-8 pt-8 border-t border-gray-700 text-center text-gray-400">
				© 2024 Guerra Láser. Todos los derechos reservados.
			</div>
		</div>
	</footer>
</div>
