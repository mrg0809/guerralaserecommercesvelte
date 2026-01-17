# 🚀 INSTALACIÓN: Módulo de Clientes - FASE 1

## ⚡ Inicio Rápido

### Paso 1: Ejecutar Migration en Supabase

**Opción A - Supabase Dashboard (MÁS FÁCIL):**

1. Abre: https://supabase.com/dashboard/project/ugxuhfmjxvhglswxspiv/sql/new

2. Copia TODO el contenido del archivo:
   ```
   database/migrations/create_customers_table.sql
   ```

3. Pégalo en el editor SQL

4. Click en **"Run"** (botón verde en la esquina superior derecha)

5. ✅ Deberías ver: "Success. No rows returned"

---

**Opción B - Script Automatizado:**

```bash
chmod +x setup-customers.sh
./setup-customers.sh
```

---

### Paso 2: Generar Tipos TypeScript

```bash
supabase gen types typescript --project-id ugxuhfmjxvhglswxspiv > src/lib/types/database.types.ts
```

**Si da error:**
1. Asegúrate de estar logueado: `supabase login`
2. Verifica el project ID: `supabase projects list`

---

### Paso 3: Verificar Instalación

1. Inicia el servidor:
   ```bash
   npm run dev
   ```

2. Abre el navegador:
   - **Dashboard**: http://localhost:5173/admin
   - **Clientes**: http://localhost:5173/admin/clientes
   - **Cotizaciones**: http://localhost:5173/admin/cotizaciones

3. ✅ Si no hay errores de compilación, ¡todo está listo!

---

## 📋 Verificación Manual

### 1. Verificar Tabla en Supabase

1. Ve a: https://supabase.com/dashboard/project/ugxuhfmjxvhglswxspiv/editor

2. Busca la tabla `customers` en el panel izquierdo

3. Deberías ver:
   - ✅ Tabla `customers`
   - ✅ Columnas: id, customer_number, contact_name, email, etc.
   - ✅ Índices creados
   - ✅ Función `generate_customer_number()`

### 2. Verificar RLS (Row Level Security)

1. Ve a: https://supabase.com/dashboard/project/ugxuhfmjxvhglswxspiv/auth/policies

2. Busca políticas para tabla `customers`:
   - ✅ "Admins can do everything on customers"
   - ✅ "Authenticated users can view customers"

### 3. Probar Funcionalidad

**Crear primer cliente:**
1. Ve a: http://localhost:5173/admin/clientes
2. Click en "➕ Nuevo Cliente"
3. Llena los datos:
   - Nombre: Test Cliente
   - Email: test@test.com
4. Click en "➕ Crear Cliente"
5. ✅ Deberías ver el cliente en la lista con número CLI-2026-0001

**Probar búsqueda:**
1. Ve a: http://localhost:5173/admin/cotizaciones
2. En "Datos del Cliente" verás "¿Cliente existente?"
3. Escribe "test" en el buscador
4. ✅ Debería aparecer "Test Cliente" en el dropdown
5. Selecciónalo
6. ✅ Los datos se deben autocompletar

---

## 🐛 Solución de Problemas

### Error: "relation customers does not exist"

**Causa**: No ejecutaste la migration

**Solución**:
1. Ve al **Paso 1** arriba
2. Ejecuta la migration en Supabase Dashboard

---

### Error: "Property 'customers' does not exist on type..."

**Causa**: Tipos TypeScript no actualizados

**Solución**:
```bash
# 1. Asegúrate de que la tabla exista en Supabase
# 2. Genera los tipos:
supabase gen types typescript --project-id ugxuhfmjxvhglswxspiv > src/lib/types/database.types.ts

# 3. Reinicia el servidor:
npm run dev
```

---

### Error: "permission denied for table customers"

**Causa**: Tu usuario no tiene rol de admin

**Solución**:
1. Ve a: https://supabase.com/dashboard/project/ugxuhfmjxvhglswxspiv/auth/users
2. Click en tu usuario
3. En "Raw user meta data" agrega:
   ```json
   {
     "role": "admin"
   }
   ```
4. Click en "Update user"

---

### La búsqueda de clientes no funciona

**Causa**: Índices no creados o tabla vacía

**Solución**:
1. Verifica que la tabla tenga datos
2. Si está vacía, crea un cliente de prueba
3. Verifica índices en SQL:
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'customers';
   ```

---

## ✅ Checklist de Instalación

- [ ] Migration ejecutada en Supabase
- [ ] Tabla `customers` visible en dashboard
- [ ] Función `generate_customer_number()` creada
- [ ] Políticas RLS activas
- [ ] Tipos TypeScript generados
- [ ] Sin errores de compilación
- [ ] Página `/admin/clientes` carga correctamente
- [ ] Puedo crear un cliente de prueba
- [ ] Búsqueda funciona en cotizaciones
- [ ] Datos se autocompletan al seleccionar cliente

---

## 📚 Documentación Completa

- **Plan Maestro**: [CRM_HELPDESK_MASTERPLAN.md](CRM_HELPDESK_MASTERPLAN.md)
- **Implementación Fase 1**: [CRM_FASE1_IMPLEMENTATION.md](CRM_FASE1_IMPLEMENTATION.md)

---

## 🎉 ¡Listo para Usar!

Una vez completados todos los pasos:

1. **Gestiona clientes**: http://localhost:5173/admin/clientes
2. **Crea cotizaciones**: http://localhost:5173/admin/cotizaciones
3. **Busca y selecciona** clientes existentes al crear cotizaciones
4. Los datos se **autocompletan** automáticamente

---

## 🔜 Próximos Pasos

Cuando estés listo para continuar:
- **FASE 2**: Órdenes de Servicio
- **FASE 3**: Sistema de Tickets
- **FASE 4**: Portal de Clientes

Ver [CRM_HELPDESK_MASTERPLAN.md](CRM_HELPDESK_MASTERPLAN.md) para más detalles.

---

**¿Necesitas ayuda?** Revisa la documentación completa o verifica cada paso del checklist.
