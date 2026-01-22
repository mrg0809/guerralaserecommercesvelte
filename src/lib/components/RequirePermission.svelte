<!--
	Componente para proteger contenido basado en permisos
	Uso:
		<RequirePermission permission="view_products">
			<button>Editar Producto</button>
		</RequirePermission>
		
		<RequirePermission permission="view_products" fallback={<p>No tienes permiso</p>}>
			<button>Editar Producto</button>
		</RequirePermission>
		
		<RequirePermission role="admin">
			<button>Solo Admin</button>
		</RequirePermission>
-->

<script lang="ts">
	import { userStore, checkPermission, checkRole, checkAnyRole, checkAnyPermission } from '$lib/stores/user';
	import type { UserRole, Permission } from '$lib/types/roles';

	interface Props {
		permission?: Permission;
		permissions?: Permission[];
		requireAll?: boolean; // Si es true, requiere todos los permisos; si es false, requiere al menos uno
		role?: UserRole;
		roles?: UserRole[];
		requireAnyRole?: boolean; // Si es true, requiere al menos uno de los roles
		fallback?: any;
		children: any;
	}

	let {
		permission,
		permissions = [],
		requireAll = false,
		role,
		roles = [],
		requireAnyRole = true,
		fallback = null,
		children
	}: Props = $props();

	// Usar el store reactivamente
	let userState = $state({ initialized: false, loading: true, permissions: [] as Permission[], roles: [] as UserRole[] });
	
	userStore.subscribe((state) => {
		userState = state;
	});

	$: hasAccess = (() => {
		// Verificar si el store está inicializado
		if (!userState.initialized || userState.loading) {
			return false;
		}

		// Verificar por permiso único
		if (permission) {
			return userState.permissions.includes(permission);
		}

		// Verificar por múltiples permisos
		if (permissions.length > 0) {
			return requireAll
				? permissions.every((p) => userState.permissions.includes(p))
				: permissions.some((p) => userState.permissions.includes(p));
		}

		// Verificar por rol único
		if (role) {
			return userState.roles.includes(role);
		}

		// Verificar por múltiples roles
		if (roles.length > 0) {
			return requireAnyRole 
				? roles.some((r) => userState.roles.includes(r))
				: roles.every((r) => userState.roles.includes(r));
		}

		// Si no se especifica ningún requisito, denegar acceso por seguridad
		return false;
	})();
</script>

{#if hasAccess}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
