-- ============================================
-- Sistema de Roles y Permisos
-- Para Fase 2 del CRM y futuras implementaciones
-- ============================================

-- Tabla de roles disponibles
CREATE TABLE IF NOT EXISTS roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- cliente, admin, superadmin, tecnico
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de permisos disponibles
CREATE TABLE IF NOT EXISTS permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL, -- manage_products, view_orders, create_service_orders, etc.
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- products, orders, customers, services, tickets, admin
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relación muchos a muchos: roles tienen permisos
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Asignación de roles a usuarios
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, role_id)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- ============================================
-- Insertar roles base
-- ============================================

INSERT INTO roles (name, display_name, description) VALUES
    ('cliente', 'Cliente', 'Usuario cliente con acceso limitado a su información y pedidos'),
    ('admin', 'Administrador', 'Administrador con acceso a gestión de productos, pedidos y clientes'),
    ('superadmin', 'Super Administrador', 'Acceso completo al sistema, incluyendo configuración y usuarios'),
    ('tecnico', 'Técnico', 'Técnico de campo con acceso a órdenes de servicio asignadas')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Insertar permisos base
-- ============================================

-- Permisos de Productos
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_products', 'Ver Productos', 'Ver lista de productos', 'products'),
    ('create_products', 'Crear Productos', 'Crear nuevos productos', 'products'),
    ('edit_products', 'Editar Productos', 'Modificar productos existentes', 'products'),
    ('delete_products', 'Eliminar Productos', 'Eliminar productos', 'products'),
    ('manage_product_prices', 'Gestionar Precios', 'Modificar precios de productos', 'products')
ON CONFLICT (name) DO NOTHING;

-- Permisos de Categorías
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_categories', 'Ver Categorías', 'Ver categorías', 'products'),
    ('manage_categories', 'Gestionar Categorías', 'Crear, editar y eliminar categorías', 'products')
ON CONFLICT (name) DO NOTHING;

-- Permisos de Clientes
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_customers', 'Ver Clientes', 'Ver lista de clientes', 'customers'),
    ('create_customers', 'Crear Clientes', 'Crear nuevos clientes', 'customers'),
    ('edit_customers', 'Editar Clientes', 'Modificar información de clientes', 'customers'),
    ('delete_customers', 'Eliminar Clientes', 'Eliminar clientes', 'customers'),
    ('view_own_customer', 'Ver Propio Perfil', 'Ver su propio perfil de cliente', 'customers')
ON CONFLICT (name) DO NOTHING;

-- Permisos de Pedidos
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_orders', 'Ver Pedidos', 'Ver lista de pedidos', 'orders'),
    ('manage_orders', 'Gestionar Pedidos', 'Crear, editar y cambiar estado de pedidos', 'orders'),
    ('view_own_orders', 'Ver Propios Pedidos', 'Ver sus propios pedidos', 'orders')
ON CONFLICT (name) DO NOTHING;

-- Permisos de Cotizaciones
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_quotations', 'Ver Cotizaciones', 'Ver cotizaciones', 'quotations'),
    ('create_quotations', 'Crear Cotizaciones', 'Crear nuevas cotizaciones', 'quotations'),
    ('edit_quotations', 'Editar Cotizaciones', 'Modificar cotizaciones', 'quotations'),
    ('delete_quotations', 'Eliminar Cotizaciones', 'Eliminar cotizaciones', 'quotations')
ON CONFLICT (name) DO NOTHING;

-- Permisos de Servicios (Fase 2)
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_service_orders', 'Ver Órdenes de Servicio', 'Ver órdenes de servicio', 'services'),
    ('create_service_orders', 'Crear Órdenes de Servicio', 'Crear nuevas órdenes de servicio', 'services'),
    ('assign_service_orders', 'Asignar Órdenes', 'Asignar órdenes a técnicos', 'services'),
    ('complete_service_orders', 'Completar Órdenes', 'Completar órdenes de servicio', 'services'),
    ('view_assigned_services', 'Ver Servicios Asignados', 'Ver servicios asignados a sí mismo', 'services')
ON CONFLICT (name) DO NOTHING;

-- Permisos de Tickets/Helpdesk (Fase 3)
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_tickets', 'Ver Tickets', 'Ver tickets de soporte', 'tickets'),
    ('create_tickets', 'Crear Tickets', 'Crear nuevos tickets', 'tickets'),
    ('assign_tickets', 'Asignar Tickets', 'Asignar tickets a técnicos', 'tickets'),
    ('resolve_tickets', 'Resolver Tickets', 'Resolver tickets de soporte', 'tickets'),
    ('view_own_tickets', 'Ver Propios Tickets', 'Ver sus propios tickets', 'tickets')
ON CONFLICT (name) DO NOTHING;

-- Permisos de Administración
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_admin_panel', 'Ver Panel Admin', 'Acceder al panel de administración', 'admin'),
    ('manage_users', 'Gestionar Usuarios', 'Crear, editar y asignar roles a usuarios', 'admin'),
    ('manage_roles', 'Gestionar Roles', 'Gestionar roles y permisos del sistema', 'admin'),
    ('view_reports', 'Ver Reportes', 'Acceder a reportes y estadísticas', 'admin'),
    ('manage_settings', 'Gestionar Configuración', 'Modificar configuración del sistema', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Permisos de Inventario
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_inventory', 'Ver Inventario', 'Ver inventario de productos', 'inventory'),
    ('manage_inventory', 'Gestionar Inventario', 'Modificar niveles de inventario', 'inventory')
ON CONFLICT (name) DO NOTHING;

-- Permisos de Bundles
INSERT INTO permissions (name, display_name, description, category) VALUES
    ('view_bundles', 'Ver Bundles', 'Ver paquetes de productos', 'products'),
    ('manage_bundles', 'Gestionar Bundles', 'Crear y editar bundles', 'products')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Asignar permisos a roles
-- ============================================

-- Cliente: permisos básicos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'cliente'
AND p.name IN (
    'view_products',
    'view_categories',
    'view_own_customer',
    'view_own_orders',
    'create_quotations',
    'view_own_tickets',
    'create_tickets'
)
ON CONFLICT DO NOTHING;

-- Admin: permisos de gestión
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
AND p.name IN (
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
    'view_reports'
)
ON CONFLICT DO NOTHING;

-- Superadmin: todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- Técnico: permisos de servicios
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'tecnico'
AND p.name IN (
    'view_assigned_services',
    'complete_service_orders',
    'view_tickets',
    'resolve_tickets',
    'view_own_tickets'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Funciones helper para verificar permisos
-- ============================================

-- Función para obtener roles de un usuario
CREATE OR REPLACE FUNCTION get_user_roles(user_uuid UUID)
RETURNS TABLE(role_name VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT r.name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid
    AND ur.is_active = true
    AND r.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si un usuario tiene un permiso específico
CREATE OR REPLACE FUNCTION user_has_permission(user_uuid UUID, permission_name VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    has_perm BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_uuid
        AND ur.is_active = true
        AND p.name = permission_name
    ) INTO has_perm;
    
    RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si un usuario tiene un rol específico
CREATE OR REPLACE FUNCTION user_has_role(user_uuid UUID, role_name VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    has_role BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_uuid
        AND ur.is_active = true
        AND r.is_active = true
        AND r.name = role_name
    ) INTO has_role;
    
    RETURN COALESCE(has_role, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener todos los permisos de un usuario
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS TABLE(permission_name VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.name
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_uuid
    AND ur.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Políticas RLS (Row Level Security)
-- ============================================

-- Habilitar RLS en las tablas
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden ver roles activos
CREATE POLICY "Anyone can view active roles"
    ON roles FOR SELECT
    USING (is_active = true);

-- Política: Todos pueden ver permisos
CREATE POLICY "Anyone can view permissions"
    ON permissions FOR SELECT
    USING (true);

-- Política: Todos pueden ver role_permissions
CREATE POLICY "Anyone can view role_permissions"
    ON role_permissions FOR SELECT
    USING (true);

-- Política: Usuarios pueden ver sus propios roles
CREATE POLICY "Users can view their own roles"
    ON user_roles FOR SELECT
    USING (auth.uid() = user_id);

-- Política: Solo superadmins pueden gestionar roles y permisos
CREATE POLICY "Only superadmins can manage roles"
    ON roles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'superadmin'
            AND ur.is_active = true
        )
    );

CREATE POLICY "Only superadmins can manage permissions"
    ON permissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'superadmin'
            AND ur.is_active = true
        )
    );

CREATE POLICY "Only superadmins can manage role_permissions"
    ON role_permissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'superadmin'
            AND ur.is_active = true
        )
    );

CREATE POLICY "Only superadmins can manage user_roles"
    ON user_roles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name = 'superadmin'
            AND ur.is_active = true
        )
    );

-- ============================================
-- Comentarios para documentación
-- ============================================

COMMENT ON TABLE roles IS 'Roles disponibles en el sistema';
COMMENT ON TABLE permissions IS 'Permisos disponibles en el sistema';
COMMENT ON TABLE role_permissions IS 'Relación entre roles y permisos';
COMMENT ON TABLE user_roles IS 'Asignación de roles a usuarios';
COMMENT ON FUNCTION get_user_roles IS 'Obtiene todos los roles activos de un usuario';
COMMENT ON FUNCTION user_has_permission IS 'Verifica si un usuario tiene un permiso específico';
COMMENT ON FUNCTION user_has_role IS 'Verifica si un usuario tiene un rol específico';
COMMENT ON FUNCTION get_user_permissions IS 'Obtiene todos los permisos de un usuario';
