# Gestión de Usuarios

Documentación unificada del módulo de usuarios: configuración, permisos y creación de cuentas.

## Tabla de contenidos

1. [Configuración del módulo](#configuración-del-módulo)
2. [Habilitar creación de usuarios](#habilitar-creación-de-usuarios)

---

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


---


# 👥 Cómo Habilitar la Creación de Usuarios

El sistema de creación de usuarios **ya está completamente implementado**. Solo necesitas otorgar permisos de **superadmin** a tu usuario.

---

## ✅ Funcionalidad Existente

- ✅ Página de gestión de usuarios en `/admin/usuarios`
- ✅ Formulario modal para crear nuevos usuarios
- ✅ Asignación de roles a usuarios
- ✅ Validaciones de seguridad (solo superadmins pueden crear)
- ✅ API endpoints protegidos

---

## 🔧 Otorgar Permisos de Superadmin

### Opción 1: Via Supabase Dashboard (Más Fácil)

1. **Ve a tu dashboard de Supabase**
   - URL: https://app.supabase.com → tu proyecto

2. **Navega a SQL Editor**
   - Click izquierdo en "SQL Editor"

3. **Ejecuta este SQL** con tu UUID de usuario:

```sql
-- Primero, obtén tu UUID de usuario ejecutando esto:
SELECT id, email FROM auth.users WHERE email = 'tu-email@ejemplo.com';

-- Luego, asigna el rol superadmin (reemplaza 'TU_UUID_AQUI'):
INSERT INTO user_roles (user_id, role_id, is_active)
SELECT 'TU_UUID_AQUI', id, true
FROM roles
WHERE name = 'superadmin'
ON CONFLICT (user_id, role_id) DO UPDATE
SET is_active = true;
```

4. **Recarga la aplicación**
   - Presiona F5 en tu navegador
   - Ahora deberías ver el botón "➕ Nuevo Usuario"

---

### Opción 2: Via Línea de Comandos (Avanzado)

```bash
# Conéctate a tu base de datos Supabase
# Primero obtén tu USER_UUID
USER_EMAIL="tu-email@ejemplo.com"
USER_UUID=$(curl -s "https://api.supabase.com/projects/YOUR_PROJECT_ID/api/sql" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d "SELECT id FROM auth.users WHERE email = '$USER_EMAIL'" | jq -r '.[0].id')

# Asigna el rol
ROLE_QUERY="INSERT INTO user_roles (user_id, role_id, is_active) SELECT '$USER_UUID', id, true FROM roles WHERE name = 'superadmin' ON CONFLICT (user_id, role_id) DO UPDATE SET is_active = true;"
```

---

## 🎯 Verificar que Funcionó

1. **Abre la página de usuarios**: `http://localhost:5173/admin/usuarios`

2. **Deberías ver**:
   - ✅ Estadísticas de usuarios
   - ✅ Botón "➕ Nuevo Usuario" en la esquina superior derecha
   - ✅ Lista de usuarios existentes

3. **Prueba crear un usuario**:
   - Click en "➕ Nuevo Usuario"
   - Ingresa un email y contraseña
   - Click en "Crear Usuario"

---

## 📋 Permisos Disponibles

Una vez que eres superadmin, tienes estos permisos:

| Permiso | Descripción |
|---------|-----------|
| `manage_users` | Crear, editar y asignar roles a usuarios |
| `view_admin_panel` | Acceder a todo el panel de administración |
| Todos los demás | Superadmin tiene acceso total |

---

## 🔍 Troubleshooting

### No aparece el botón "Nuevo Usuario"

**Causa**: No tienes el permiso `manage_users`

**Solución**:
1. Ve a Supabase Dashboard → SQL Editor
2. Ejecuta:
```sql
SELECT ur.user_id, r.name 
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = 'TU_UUID'
AND ur.is_active = true;
```
3. Si no aparece nada, ejecuta el SQL de "Opción 1" arriba

### Error "No autorizado" al crear usuario

**Causa**: La sesión no se actualizó

**Solución**:
1. Cierra sesión completamente
2. Cierra el navegador
3. Vuelve a abrir y accede al panel

---

## 📚 Archivos Relevantes

- [Página de Usuarios](src/routes/admin/usuarios/+page.svelte) - Frontend
- [API Create User](src/routes/api/users/create/+server.ts) - Backend
- [Sistema de Roles](ROLES_PERMISSIONS_SETUP.md) - Documentación de roles

---

## 💡 Próximos Pasos

Una vez que puedas crear usuarios, puedes:

1. ✅ Crear nuevos usuarios
2. ✅ Asignar roles (admin, técnico, cliente)
3. ✅ Gestionar permisos por rol
4. ✅ Auditar cambios de roles

---

**¿Necesitas ayuda?** Revisa los logs del navegador (F12 → Console) para más detalles.
