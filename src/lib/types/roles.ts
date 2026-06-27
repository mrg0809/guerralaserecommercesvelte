/**
 * Tipos y constantes para el sistema de roles y permisos
 */

export type UserRole = 'cliente' | 'admin' | 'superadmin' | 'tecnico';

export type Permission =
	// Productos
	| 'view_products'
	| 'create_products'
	| 'edit_products'
	| 'delete_products'
	| 'manage_product_prices'
	// Categorías
	| 'view_categories'
	| 'manage_categories'
	// Clientes
	| 'view_customers'
	| 'create_customers'
	| 'edit_customers'
	| 'delete_customers'
	| 'view_own_customer'
	// Pedidos
	| 'view_orders'
	| 'manage_orders'
	| 'view_own_orders'
	// Cotizaciones
	| 'view_quotations'
	| 'create_quotations'
	| 'edit_quotations'
	| 'delete_quotations'
	// Servicios (Fase 2)
	| 'view_service_orders'
	| 'create_service_orders'
	| 'assign_service_orders'
	| 'complete_service_orders'
	| 'view_assigned_services'
	// Tickets/Helpdesk (Fase 3)
	| 'view_tickets'
	| 'create_tickets'
	| 'assign_tickets'
	| 'resolve_tickets'
	| 'view_own_tickets'
	// Administración
	| 'view_admin_panel'
	| 'manage_users'
	| 'manage_roles'
	| 'view_reports'
	| 'manage_settings'
	// Inventario
	| 'view_inventory'
	| 'manage_inventory'
	// Bundles
	| 'view_bundles'
	| 'manage_bundles'
	// Entregas de máquinas
	| 'view_machine_deliveries'
	| 'create_machine_deliveries'
	| 'complete_machine_deliveries'
	| 'view_technician_panel'
	// Asistente IA
	| 'use_ai_assistant';

export interface Role {
	id: string;
	name: UserRole;
	display_name: string;
	description?: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface PermissionInfo {
	id: string;
	name: Permission;
	display_name: string;
	description?: string;
	category?: string;
	created_at: string;
}

export interface UserRoleAssignment {
	id: string;
	user_id: string;
	role_id: string;
	assigned_at: string;
	assigned_by?: string;
	is_active: boolean;
	role?: Role;
}

export interface UserPermissions {
	roles: UserRole[];
	permissions: Permission[];
}

/**
 * Mapeo de roles a permisos por defecto (para referencia rápida)
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
	cliente: [
		'view_products',
		'view_categories',
		'view_own_customer',
		'view_own_orders',
		'create_quotations',
		'view_own_tickets',
		'create_tickets'
	],
	admin: [
		'view_admin_panel',
		'view_products',
		'create_products',
		'edit_products',
		'delete_products',
		'manage_product_prices',
		'view_categories',
		'manage_categories',
		'view_customers',
		'create_customers',
		'edit_customers',
		'view_orders',
		'manage_orders',
		'view_quotations',
		'create_quotations',
		'edit_quotations',
		'delete_quotations',
		'view_service_orders',
		'create_service_orders',
		'assign_service_orders',
		'view_tickets',
		'create_tickets',
		'assign_tickets',
		'resolve_tickets',
		'view_inventory',
		'manage_inventory',
		'view_bundles',
		'manage_bundles',
		'view_reports',
		'view_machine_deliveries',
		'create_machine_deliveries',
		'complete_machine_deliveries',
		'use_ai_assistant'
	],
	superadmin: [
		// Superadmin tiene todos los permisos
		'view_admin_panel',
		'manage_users',
		'manage_roles',
		'view_reports',
		'manage_settings',
		'view_products',
		'create_products',
		'edit_products',
		'delete_products',
		'manage_product_prices',
		'view_categories',
		'manage_categories',
		'view_customers',
		'create_customers',
		'edit_customers',
		'delete_customers',
		'view_orders',
		'manage_orders',
		'view_quotations',
		'create_quotations',
		'edit_quotations',
		'delete_quotations',
		'view_service_orders',
		'create_service_orders',
		'assign_service_orders',
		'complete_service_orders',
		'view_tickets',
		'create_tickets',
		'assign_tickets',
		'resolve_tickets',
		'view_inventory',
		'manage_inventory',
		'view_bundles',
		'manage_bundles',
		'view_machine_deliveries',
		'create_machine_deliveries',
		'complete_machine_deliveries',
		'use_ai_assistant'
	],
	tecnico: [
		'view_assigned_services',
		'complete_service_orders',
		'view_tickets',
		'resolve_tickets',
		'view_own_tickets',
		'view_machine_deliveries',
		'complete_machine_deliveries',
		'view_technician_panel'
	]
};

/**
 * Nombres legibles de permisos
 */
export const PERMISSION_DISPLAY_NAMES: Record<Permission, string> = {
	view_products: 'Ver Productos',
	create_products: 'Crear Productos',
	edit_products: 'Editar Productos',
	delete_products: 'Eliminar Productos',
	manage_product_prices: 'Gestionar Precios',
	view_categories: 'Ver Categorías',
	manage_categories: 'Gestionar Categorías',
	view_customers: 'Ver Clientes',
	create_customers: 'Crear Clientes',
	edit_customers: 'Editar Clientes',
	delete_customers: 'Eliminar Clientes',
	view_own_customer: 'Ver Propio Perfil',
	view_orders: 'Ver Pedidos',
	manage_orders: 'Gestionar Pedidos',
	view_own_orders: 'Ver Propios Pedidos',
	view_quotations: 'Ver Cotizaciones',
	create_quotations: 'Crear Cotizaciones',
	edit_quotations: 'Editar Cotizaciones',
	delete_quotations: 'Eliminar Cotizaciones',
	view_service_orders: 'Ver Órdenes de Servicio',
	create_service_orders: 'Crear Órdenes de Servicio',
	assign_service_orders: 'Asignar Órdenes',
	complete_service_orders: 'Completar Órdenes',
	view_assigned_services: 'Ver Servicios Asignados',
	view_tickets: 'Ver Tickets',
	create_tickets: 'Crear Tickets',
	assign_tickets: 'Asignar Tickets',
	resolve_tickets: 'Resolver Tickets',
	view_own_tickets: 'Ver Propios Tickets',
	view_admin_panel: 'Ver Panel Admin',
	manage_users: 'Gestionar Usuarios',
	manage_roles: 'Gestionar Roles',
	view_reports: 'Ver Reportes',
	manage_settings: 'Gestionar Configuración',
	view_inventory: 'Ver Inventario',
	manage_inventory: 'Gestionar Inventario',
	view_bundles: 'Ver Bundles',
	manage_bundles: 'Gestionar Bundles',
	view_machine_deliveries: 'Ver Entregas de Máquinas',
	create_machine_deliveries: 'Crear Entregas',
	complete_machine_deliveries: 'Completar Entregas',
	view_technician_panel: 'Panel Técnico',
	use_ai_assistant: 'Usar Asistente IA'
};

/**
 * Nombres legibles de roles
 */
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
	cliente: 'Cliente',
	admin: 'Administrador',
	superadmin: 'Super Administrador',
	tecnico: 'Técnico'
};
