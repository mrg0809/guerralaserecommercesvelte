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

	interface Props {
		redirectTo?: string;
		fallback?: any;
		children: any;
	}

	let { redirectTo = '/login', fallback = null, children }: Props = $props();

	// Usar el store reactivamente
	let userState = $state({ initialized: false, loading: true, user: null });
	
	userStore.subscribe((state) => {
		userState = state;
	});

	$: isAuthenticated = userState.initialized && !userState.loading && userState.user !== null;

	$: {
		if (!isAuthenticated && redirectTo) {
			goto(redirectTo);
		}
	}
</script>

{#if isAuthenticated}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
