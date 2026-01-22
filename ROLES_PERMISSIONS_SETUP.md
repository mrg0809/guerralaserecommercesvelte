# 🔐 Sistema de Roles y Permisos - Guía de Configuración

## 📋 Descripción

Sistema completo de gestión de roles y permisos para el e-commerce Guerra Láser, preparado para la Fase 2 del CRM y futuras implementaciones.

---

## 🚀 Instalación

### Paso 1: Ejecutar la Migración SQL

1. Abre el SQL Editor en Supabase:
   ```
   https://supabase.com/dashboard/project/[TU_PROJECT_ID]/sql/new
   ```

2. Copia y ejecuta el contenido de:
   ```
   database/migrations/create_roles_permissions.sql
   ```

3. ✅ Verifica que se hayan creado las tablas:
   - `roles`
   - `permissions`
   - `role_permissions`
   - `user_roles`

---

## 👥 Roles Disponibles

### 1. **Cliente** (`cliente`)
- Acceso limitado a su información y pedidos
- Puede crear cotizaciones
- Puede crear tickets de soporte

### 2. **Administrador** (`admin`)
- Acceso completo al panel de administración
- Gestión de productos, categorías, pedidos
- Gestión de clientes y cotizaciones
- Acceso a inventario y bundles
- Puede crear y asignar órdenes de servicio
- Puede gestionar tickets

### 3. **Super Administrador** (`superadmin`)
- Todos los permisos de admin
- Gestión de usuarios y roles
- Configuración del sistema
- Acceso completo a todas las funcionalidades

### 4. **Técnico** (`tecnico`)
- Ver servicios asignados
- Completar órdenes de servicio
- Ver y resolver tickets asignados

---

## 🔑 Permisos Disponibles

### Productos
- `view_products` - Ver productos
- `create_products` - Crear productos
- `edit_products` - Editar productos
- `delete_products` - Eliminar productos
- `manage_product_prices` - Gestionar precios

### Categorías
- `view_categories` - Ver categorías
- `manage_categories` - Gestionar categorías

### Clientes
- `view_customers` - Ver clientes
- `create_customers` - Crear clientes
- `edit_customers` - Editar clientes
- `delete_customers` - Eliminar clientes
- `view_own_customer` - Ver propio perfil

### Pedidos
- `view_orders` - Ver pedidos
- `manage_orders` - Gestionar pedidos
- `view_own_orders` - Ver propios pedidos

### Cotizaciones
- `view_quotations` - Ver cotizaciones
- `create_quotations` - Crear cotizaciones
- `edit_quotations` - Editar cotizaciones
- `delete_quotations` - Eliminar cotizaciones

### Servicios (Fase 2)
- `view_service_orders` - Ver órdenes de servicio
- `create_service_orders` - Crear órdenes
- `assign_service_orders` - Asignar órdenes
- `complete_service_orders` - Completar órdenes
- `view_assigned_services` - Ver servicios asignados

### Tickets/Helpdesk (Fase 3)
- `view_tickets` - Ver tickets
- `create_tickets` - Crear tickets
- `assign_tickets` - Asignar tickets
- `resolve_tickets` - Resolver tickets
- `view_own_tickets` - Ver propios tickets

### Administración
- `view_admin_panel` - Acceder al panel admin
- `manage_users` - Gestionar usuarios
- `manage_roles` - Gestionar roles
- `view_reports` - Ver reportes
- `manage_settings` - Gestionar configuración

### Inventario
- `view_inventory` - Ver inventario
- `manage_inventory` - Gestionar inventario

### Bundles
- `view_bundles` - Ver bundles
- `manage_bundles` - Gestionar bundles

---

## 💻 Uso en el Código

### 1. Verificar Permisos en Componentes

```svelte
<script>
  import { checkPermission, checkRole } from '$lib/stores/user';
  
  // Verificar permiso
  if (checkPermission('create_products')) {
    // Usuario puede crear productos
  }
  
  // Verificar rol
  if (checkRole('admin')) {
    // Usuario es admin
  }
</script>
```

### 2. Usar Componente RequirePermission

```svelte
<script>
  import RequirePermission from '$lib/components/RequirePermission.svelte';
</script>

<!-- Mostrar solo si tiene permiso -->
<RequirePermission permission="create_products">
  <button>Crear Producto</button>
</RequirePermission>

<!-- Con fallback -->
<RequirePermission 
  permission="delete_products"
  fallback={<p>No tienes permiso para eliminar</p>}
>
  <button>Eliminar</button>
</RequirePermission>

<!-- Múltiples permisos (al menos uno) -->
<RequirePermission permissions={['edit_products', 'delete_products']}>
  <button>Gestionar</button>
</RequirePermission>

<!-- Múltiples permisos (todos requeridos) -->
<RequirePermission 
  permissions={['edit_products', 'manage_product_prices']}
  requireAll={true}
>
  <button>Editar y Precios</button>
</RequirePermission>

<!-- Por rol -->
<RequirePermission role="admin">
  <button>Solo Admin</button>
</RequirePermission>
```

### 3. Usar Store Reactivo

```svelte
<script>
  import { userStore, hasPermissionStore, hasRoleStore } from '$lib/stores/user';
  
  // Store completo
  $: user = $userStore;
  
  // Store derivado para permiso específico
  $: canCreate = $hasPermissionStore('create_products');
  
  // Store derivado para rol específico
  $: isAdmin = $hasRoleStore('admin');
</script>

{#if canCreate}
  <button>Crear Producto</button>
{/if}
```

### 4. Verificar en Servidores (API Routes)

```typescript
// src/routes/api/products/+server.ts
import { hasPermission } from '$lib/services/permissions';

export async function POST({ request, locals }) {
  const session = await locals.getSession();
  
  if (!session?.user) {
    return new Response('No autorizado', { status: 401 });
  }
  
  const canCreate = await hasPermission(session.user.id, 'create_products');
  
  if (!canCreate) {
    return new Response('Sin permisos', { status: 403 });
  }
  
  // Continuar con la lógica...
}
```

---

## 🔧 Asignar Roles a Usuarios

### Opción 1: Desde Supabase Dashboard

1. Ve a: `https://supabase.com/dashboard/project/[PROJECT_ID]/auth/users`
2. Selecciona el usuario
3. Ejecuta este SQL en el SQL Editor:

```sql
-- Asignar rol de admin a un usuario
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT 
  'UUID_DEL_USUARIO',
  r.id,
  'UUID_DEL_SUPERADMIN'
FROM roles r
WHERE r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

### Opción 2: Desde el Código (Solo Superadmin)

```typescript
import { assignRoleToUser } from '$lib/services/permissions';

// Asignar rol
const result = await assignRoleToUser(
  userId,
  'admin',
  currentUserId
);

if (result.success) {
  console.log('Rol asignado correctamente');
} else {
  console.error('Error:', result.error);
}
```

---

## 📝 Ejemplos de Uso

### Proteger una Ruta Completa

```svelte
<!-- src/routes/admin/productos/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkPermission } from '$lib/stores/user';
  
  onMount(() => {
    if (!checkPermission('view_products')) {
      goto('/admin');
    }
  });
</script>
```

### Mostrar/Ocultar Elementos del Menú

El layout de admin ya está configurado para filtrar el menú según permisos:

```typescript
// En admin/+layout.svelte
const menuItems = [
  { 
    href: '/admin/productos', 
    label: 'Productos', 
    permission: 'view_products' // Solo se muestra si tiene este permiso
  },
  // ...
];
```

### Botones Condicionales

```svelte
<script>
  import { checkPermission } from '$lib/stores/user';
</script>

<button>Ver Producto</button>

{#if checkPermission('edit_products')}
  <button>Editar</button>
{/if}

{#if checkPermission('delete_products')}
  <button>Eliminar</button>
{/if}
```

---

## 🧪 Testing

### Verificar Roles y Permisos de un Usuario

```sql
-- Ver roles de un usuario
SELECT r.name, r.display_name
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = 'UUID_DEL_USUARIO'
AND ur.is_active = true;

-- Ver permisos de un usuario
SELECT p.name, p.display_name, p.category
FROM user_roles ur
JOIN role_permissions rp ON ur.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE ur.user_id = 'UUID_DEL_USUARIO'
AND ur.is_active = true
ORDER BY p.category, p.name;
```

---

## 🔒 Seguridad

### Políticas RLS

Las políticas RLS están configuradas para:
- ✅ Todos pueden ver roles y permisos activos
- ✅ Usuarios pueden ver sus propios roles
- ✅ Solo superadmins pueden gestionar roles y permisos
- ✅ Solo superadmins pueden asignar roles a usuarios

### Buenas Prácticas

1. **Siempre verificar permisos en el servidor** - No confíes solo en el frontend
2. **Usar RLS en Supabase** - Las políticas de base de datos son la última línea de defensa
3. **Validar en múltiples capas** - Frontend, API routes, y base de datos
4. **Auditar cambios** - Los cambios de roles se registran con `assigned_by` y `assigned_at`

---

## 📚 Archivos Creados

- `database/migrations/create_roles_permissions.sql` - Migración SQL
- `src/lib/types/roles.ts` - Tipos TypeScript
- `src/lib/services/permissions.ts` - Servicios para permisos
- `src/lib/stores/user.ts` - Store de Svelte para usuario
- `src/lib/components/RequirePermission.svelte` - Componente de protección
- `src/lib/components/RequireAuth.svelte` - Componente de autenticación
- `src/routes/admin/+layout.svelte` - Layout actualizado con permisos

---

## 🎯 Próximos Pasos

1. ✅ Ejecutar la migración SQL
2. ✅ Asignar roles a usuarios existentes
3. ✅ Probar el sistema con diferentes usuarios
4. ✅ Implementar protección en rutas específicas según necesidad
5. ✅ Preparar para Fase 2 (Órdenes de Servicio)

---

## ❓ Preguntas Frecuentes

**P: ¿Cómo asigno un rol a un usuario?**
R: Usa la función `assignRoleToUser()` o ejecuta SQL directamente en Supabase.

**P: ¿Puedo crear roles personalizados?**
R: Sí, inserta en la tabla `roles` y luego asigna permisos en `role_permissions`.

**P: ¿Cómo verifico permisos en el servidor?**
R: Usa las funciones de `src/lib/services/permissions.ts` que llaman a las funciones SQL.

**P: ¿Los permisos se actualizan en tiempo real?**
R: El store se actualiza cuando cambias de página. Para actualizar manualmente, llama a `userStore.refresh()`.

---

**¿Necesitas ayuda?** Revisa los ejemplos en este documento o consulta el código fuente.
