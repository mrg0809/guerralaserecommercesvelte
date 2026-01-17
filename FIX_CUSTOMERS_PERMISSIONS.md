# 🔧 FIX: Error "permission denied for table users"

## Problema
```
Error cargando clientes: 
{code: '42501', details: null, hint: null, message: 'permission denied for table users'}
```

## Causa
Las políticas RLS intentan consultar `auth.users` directamente, lo cual no está permitido.

---

## ✅ Solución Rápida

### Paso 1: Ejecutar Fix

1. Abre: https://supabase.com/dashboard/project/ugxuhfmjxvhglswxspiv/sql/new

2. Copia y pega el contenido de:
   ```
   database/migrations/fix_customers_rls.sql
   ```

3. Click en **"Run"**

4. ✅ Deberías ver: "Success"

---

### Paso 2: Verificar

1. Recarga la página: http://localhost:5173/admin/clientes

2. ✅ Ahora debería cargar sin errores

---

## 📋 Qué hace el fix

**Antes** (❌ No funcionaba):
- Intentaba verificar rol consultando `auth.users`
- Causaba error de permisos

**Ahora** (✅ Funciona):
- Permite todo a usuarios autenticados
- Perfecto para desarrollo y panel de admin

---

## 🔐 Para Producción (Opcional)

Si necesitas restringir por roles más adelante:

1. Ve a: https://supabase.com/dashboard/project/ugxuhfmjxvhglswxspiv/auth/users

2. Selecciona tu usuario

3. En "Raw user meta data" agrega:
   ```json
   {
     "role": "admin"
   }
   ```

4. Ejecuta la parte comentada del SQL (OPCIÓN 2)

---

## 🧪 Prueba

```bash
# 1. Inicia el servidor
npm run dev

# 2. Ve a clientes
# http://localhost:5173/admin/clientes

# 3. Intenta crear un cliente
# Debería funcionar sin errores
```

---

**¿Sigue sin funcionar?** Verifica:
1. Que el fix se haya ejecutado correctamente
2. Que estés logueado en Supabase
3. Recarga la página con Ctrl+Shift+R
