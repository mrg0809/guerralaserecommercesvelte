<!--
	Componente para proteger contenido que requiere autenticación
	Uso:
		<RequireAuth>
			<button>Acción que requiere login</button>
		</RequireAuth>
		
		<RequireAuth fallback={<p>Por favor inicia sesión</p>}>
			<button>Acción que requiere login</button>
		</RequireAuth>
-->

<script lang="ts">
	import { userStore } from '$lib/stores/user';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	interface Props {
		redirectTo?: string;
		fallback?: any;
		children: any;
	}

	let { redirectTo = '/login', fallback = null, children }: Props = $props();

	// Usar el store reactivamente
	let userState = $state({ initialized: false, loading: true, user: null });
	let wasAuthenticated = $state(false);
	let hasCheckedInitialAuth = $state(false);
	
	userStore.subscribe((state) => {
		userState = state;
		
		// Marcar que estuvo autenticado si tiene usuario
		if (state.user !== null) {
			wasAuthenticated = true;
		}
		
		// Marcar que ya verificamos la autenticación inicial
		if (state.initialized) {
			hasCheckedInitialAuth = true;
		}
	});

	$: isAuthenticated = userState.initialized && !userState.loading && userState.user !== null;

	// Solo redirigir si:
	// 1. Ya verificamos la autenticación inicial
	// 2. Nunca estuvo autenticado (no es un timeout temporal)
	// 3. No está cargando
	$: {
		if (hasCheckedInitialAuth && !isAuthenticated && !wasAuthenticated && !userState.loading && redirectTo) {
			console.log('🔍 RequireAuth: redirigiendo a login (nunca autenticado)');
			goto(redirectTo);
		}
	}
</script>

{#if isAuthenticated}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
