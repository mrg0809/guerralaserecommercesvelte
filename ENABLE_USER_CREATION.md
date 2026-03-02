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
