# 👥 Módulo de Gestión de Usuarios - Guía de Configuración

## 📋 Descripción

Módulo completo para gestionar usuarios del sistema, asignar roles y permisos. Permite a superadmins crear y modificar usuarios, y a admins ver usuarios y sus roles.

---

## 🚀 Instalación

### Paso 1: Ejecutar Migración SQL

1. Abre el SQL Editor en Supabase:
   ```
   https://supabase.com/dashboard/project/[TU_PROJECT_ID]/sql/new
   ```

2. Copia y ejecuta el contenido de:
   ```
   database/migrations/create_users_management_functions.sql
   ```

3. ✅ Verifica que se haya creado la función:
   - `get_all_users_with_roles()`

---

### Paso 2: Configurar Variables de Entorno

Asegúrate de tener estas variables en tu archivo `.env`:

```env
PUBLIC_SUPABASE_URL=tu-url-de-supabase
PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

**⚠️ IMPORTANTE**: 
- `SUPABASE_SERVICE_ROLE_KEY` es una clave privada que **NUNCA** debe exponerse al cliente
- Solo se usa en endpoints del servidor (`+server.ts`)
- Encuéntrala en: Supabase Dashboard → Settings → API → `service_role` key

---

## 🔐 Permisos Requeridos

### Para Ver Usuarios
- `view_admin_panel` - Cualquier admin puede ver usuarios

### Para Crear/Modificar Usuarios
- `manage_users` - Solo superadmins pueden crear y modificar usuarios

---

## 💻 Funcionalidades

### 1. Listar Usuarios
- Ver todos los usuarios del sistema
- Ver roles asignados a cada usuario
- Ver fecha de creación y último acceso
- Búsqueda por email o rol

### 2. Crear Usuarios (Solo Superadmin)
- Crear nuevos usuarios con email y contraseña
- El usuario se crea con email confirmado automáticamente
- Después de crear, puedes asignar roles

### 3. Gestionar Roles (Solo Superadmin)
- Asignar roles a usuarios
- Remover roles de usuarios
- Ver roles disponibles

---

## 📁 Archivos Creados

### Frontend
- `src/routes/admin/usuarios/+page.svelte` - Página principal de usuarios
- `src/lib/services/users.ts` - Servicio para gestionar usuarios

### Backend (API Routes)
- `src/routes/api/users/list/+server.ts` - Endpoint para listar usuarios
- `src/routes/api/users/create/+server.ts` - Endpoint para crear usuarios
- `src/routes/api/users/update/+server.ts` - Endpoint para actualizar usuarios

### Base de Datos
- `database/migrations/create_users_management_functions.sql` - Función SQL

---

## 🎯 Uso

### Acceder al Módulo

1. Inicia sesión como admin o superadmin
2. Ve a: `http://localhost:5173/admin/usuarios`
3. El menú de admin ahora incluye "👥 Usuarios"

### Crear un Nuevo Usuario (Superadmin)

1. Click en "➕ Nuevo Usuario"
2. Ingresa:
   - Email del usuario
   - Contraseña (mínimo 6 caracteres)
   - Confirma la contraseña
3. Click en "Crear Usuario"
4. ✅ El usuario se crea y aparece en la lista

### Asignar Roles a un Usuario (Superadmin)

1. En la lista de usuarios, click en "⚙️ Roles" del usuario
2. En el modal:
   - Ver roles actuales del usuario
   - Click en un rol disponible para asignarlo
   - Click en "✕" para remover un rol
3. Los cambios se guardan automáticamente

---

## 🔒 Seguridad

### Endpoints Protegidos

Todos los endpoints del servidor verifican:
1. ✅ Autenticación del usuario (token válido)
2. ✅ Permisos adecuados (admin para ver, superadmin para crear/modificar)

### Verificación de Permisos

```typescript
// En el frontend
import { checkPermission } from '$lib/stores/user';

if (checkPermission('manage_users')) {
  // Mostrar botón de crear usuario
}
```

### En el Servidor

Los endpoints verifican roles antes de ejecutar acciones:

```typescript
// Verificar que sea superadmin
const roles = userRoles?.map(ur => ur.roles?.name) || [];
if (!roles.includes('superadmin')) {
  return json({ error: 'Sin permisos' }, { status: 403 });
}
```

---

## 📊 Estructura de Datos

### Usuario con Roles

```typescript
interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: UserRole[]; // ['admin', 'tecnico', etc.]
}
```

---

## 🧪 Testing

### Verificar Instalación

1. **Verificar función SQL**:
   ```sql
   SELECT get_all_users_with_roles();
   ```

2. **Verificar endpoint**:
   ```bash
   curl http://localhost:5173/api/users/list
   ```

3. **Verificar página**:
   - Ve a: `http://localhost:5173/admin/usuarios`
   - Deberías ver la lista de usuarios

### Probar Creación de Usuario

1. Inicia sesión como superadmin
2. Ve a `/admin/usuarios`
3. Click en "➕ Nuevo Usuario"
4. Crea un usuario de prueba
5. ✅ Verifica que aparezca en la lista

### Probar Asignación de Roles

1. Selecciona un usuario
2. Click en "⚙️ Roles"
3. Asigna un rol (ej: "admin")
4. ✅ Verifica que el rol aparezca en la lista

---

## ❓ Preguntas Frecuentes

**P: ¿Por qué no puedo crear usuarios?**
R: Solo los superadmins pueden crear usuarios. Verifica que tu usuario tenga el rol `superadmin`.

**P: ¿Cómo asigno el rol de superadmin a un usuario?**
R: Debes hacerlo manualmente desde Supabase SQL Editor:
```sql
INSERT INTO user_roles (user_id, role_id)
SELECT 
  'UUID_DEL_USUARIO',
  r.id
FROM roles r
WHERE r.name = 'superadmin';
```

**P: ¿Los usuarios creados pueden iniciar sesión inmediatamente?**
R: Sí, los usuarios se crean con `email_confirm: true`, por lo que pueden iniciar sesión de inmediato.

**P: ¿Puedo cambiar la contraseña de un usuario?**
R: Por ahora no está implementado, pero puedes hacerlo desde Supabase Dashboard → Auth → Users.

**P: ¿Qué pasa si elimino un rol de un usuario?**
R: El rol se desactiva (`is_active = false`) pero no se elimina físicamente. El usuario perderá los permisos asociados a ese rol.

---

## 🔄 Próximas Mejoras

- [ ] Cambiar contraseña de usuarios
- [ ] Desactivar/activar usuarios
- [ ] Historial de cambios de roles
- [ ] Exportar lista de usuarios
- [ ] Filtros avanzados (por rol, fecha, etc.)
- [ ] Editar información del usuario (email, metadata)

---

## 📚 Referencias

- [Sistema de Roles y Permisos](./ROLES_PERMISSIONS_SETUP.md)
- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-api)

---

**¿Necesitas ayuda?** Revisa los logs del servidor o consulta la documentación de Supabase.
