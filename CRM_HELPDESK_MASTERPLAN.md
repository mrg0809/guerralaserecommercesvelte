# 🎯 Plan Maestro: Sistema CRM y Helpdesk - Guerra Laser

## 📋 Visión General

Sistema integral de gestión de clientes, servicios y soporte técnico para Guerra Laser, implementado en fases incrementales.

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA GUERRA LASER                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   MÓDULO CRM    │  │  MÓDULO FSM     │  │  HELPDESK   │ │
│  │   (Clientes)    │  │  (Servicios)    │  │  (Soporte)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│           │                    │                    │        │
│           └────────────────────┴────────────────────┘        │
│                            │                                 │
│                   ┌────────▼────────┐                       │
│                   │   SUPABASE DB   │                       │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

**Componentes:**
- **CRM (Customer Relationship Management)**: Base de datos de clientes
- **FSM (Field Service Management)**: Órdenes de instalación/servicios
- **Helpdesk**: Sistema de tickets y soporte técnico

---

## 📅 Fases de Implementación

### 🟢 FASE 1: Base de Datos de Clientes (INMEDIATO)
**Objetivo**: Poder guardar y reutilizar datos de clientes en cotizaciones

**Funcionalidades:**
- ✅ Registro de clientes con datos completos
- ✅ Búsqueda rápida de clientes existentes
- ✅ Autocompletar datos en cotizaciones
- ✅ CRUD básico de clientes
- ✅ Integración con módulo de cotizaciones

**Entregables:**
- Tabla `customers` en base de datos
- Página `/admin/clientes` para gestión
- Componente de búsqueda de clientes
- Integración con cotizaciones

---

### 🟡 FASE 2: Sistema de Órdenes de Servicio (SIGUIENTE)
**Objetivo**: Gestionar instalaciones, mantenimientos y servicios técnicos

**Funcionalidades:**
- 📋 Crear órdenes de trabajo (instalación, mantenimiento, reparación)
- 📅 Agendar servicios con calendario
- 👷 Asignar técnicos a órdenes
- 📊 Seguimiento de estados (Pendiente → En proceso → Completado)
- 📸 Documentación con fotos (antes/después)
- ✍️ Firma digital del cliente
- 💰 Control de costos y materiales
- 📄 Generación de reportes PDF

**Entregables:**
- Tablas: `service_orders`, `service_order_items`, `service_order_photos`
- Página `/admin/servicios` con calendario
- Workflows de estados
- App móvil básica para técnicos (opcional)

---

### 🔵 FASE 3: Sistema Helpdesk (CORTO PLAZO)
**Objetivo**: Sistema interno de tickets y casos de soporte

**Funcionalidades:**
- 🎫 Creación de tickets internos
- 🏷️ Categorización y prioridades
- 👤 Asignación a técnicos
- 💬 Sistema de comentarios/notas internas
- 📎 Adjuntar archivos/fotos
- 🔔 Notificaciones por email
- 📈 Métricas y reportes (tiempo de resolución, etc.)
- 🔗 Vincular tickets con clientes y órdenes de servicio

**Entregables:**
- Tablas: `support_tickets`, `ticket_comments`, `ticket_attachments`
- Página `/admin/soporte` con kanban board
- Sistema de notificaciones
- Panel de métricas

---

### 🟣 FASE 4: Portal de Clientes (MEDIANO PLAZO)
**Objetivo**: Autoservicio para clientes con cuentas

**Funcionalidades:**
- 🔐 Sistema de autenticación para clientes
- 📱 Portal web para clientes (`/portal`)
- 👁️ Ver historial de cotizaciones y órdenes
- 🎫 Crear tickets de soporte
- 📄 Descargar documentos (cotizaciones, reportes)
- 💬 Chat básico con soporte
- 📊 Dashboard personalizado

**Entregables:**
- Sistema de roles (admin/cliente)
- Rutas `/portal/*` para clientes
- Auth flow completo
- Dashboard de cliente

---

### 🔴 FASE 5: Sistema Avanzado (LARGO PLAZO)
**Objetivo**: Funcionalidades empresariales avanzadas

**Funcionalidades:**
- 📊 Analytics y BI avanzado
- 🤖 Automatizaciones (recordatorios, seguimientos)
- 📱 App móvil nativa (iOS/Android)
- 💳 Pagos en línea integrados
- 📧 Marketing automation
- 🔗 Integraciones (WhatsApp, Facebook, etc.)
- 📞 Sistema de llamadas VoIP
- 🎥 Videollamadas de soporte

---

## 🗄️ Esquema de Base de Datos

### FASE 1: Clientes

```sql
-- Tabla principal de clientes
CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_number VARCHAR(50) UNIQUE, -- CLI-2026-0001
    
    -- Datos básicos
    company_name VARCHAR(255),
    contact_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    mobile VARCHAR(50),
    rfc VARCHAR(13),
    
    -- Dirección
    street VARCHAR(255),
    neighborhood VARCHAR(100), -- Colonia
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(10),
    country VARCHAR(100) DEFAULT 'México',
    
    -- Información adicional
    customer_type VARCHAR(50) DEFAULT 'regular', -- regular, vip, wholesale
    notes TEXT,
    tags TEXT[], -- Para categorización flexible
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices para búsqueda rápida
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_company ON customers(company_name);
CREATE INDEX idx_customers_number ON customers(customer_number);

-- RLS Policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything" ON customers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid() = id
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );
```

### FASE 2: Órdenes de Servicio

```sql
-- Tabla de órdenes de servicio
CREATE TABLE service_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE, -- ORD-2026-0001
    
    -- Referencias
    customer_id UUID REFERENCES customers(id) NOT NULL,
    quotation_id UUID REFERENCES quotations(id), -- Si viene de cotización
    
    -- Información del servicio
    service_type VARCHAR(50) NOT NULL, -- installation, maintenance, repair, training
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Programación
    scheduled_date DATE,
    scheduled_time TIME,
    estimated_duration INTEGER, -- minutos
    
    -- Asignación
    assigned_to UUID REFERENCES auth.users(id),
    
    -- Dirección del servicio (puede ser diferente a la del cliente)
    service_address TEXT,
    service_latitude DECIMAL(10, 8),
    service_longitude DECIMAL(11, 8),
    
    -- Estado y seguimiento
    status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, in_progress, completed, cancelled
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    
    -- Costos
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    
    -- Resultados
    completion_notes TEXT,
    customer_signature TEXT, -- Base64 de firma
    customer_satisfaction_rating INTEGER, -- 1-5
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Ítems de la orden (materiales, productos usados)
CREATE TABLE service_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
    
    product_id UUID REFERENCES products(id),
    description VARCHAR(255),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fotos/documentos de la orden
CREATE TABLE service_order_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
    
    photo_url TEXT NOT NULL,
    photo_type VARCHAR(50), -- before, after, issue, solution
    caption TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX idx_service_orders_customer ON service_orders(customer_id);
CREATE INDEX idx_service_orders_status ON service_orders(status);
CREATE INDEX idx_service_orders_date ON service_orders(scheduled_date);
CREATE INDEX idx_service_orders_assigned ON service_orders(assigned_to);
```

### FASE 3: Sistema de Tickets

```sql
-- Tabla de tickets de soporte
CREATE TABLE support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number VARCHAR(50) UNIQUE, -- TKT-2026-0001
    
    -- Referencias
    customer_id UUID REFERENCES customers(id) NOT NULL,
    service_order_id UUID REFERENCES service_orders(id), -- Si está relacionado
    
    -- Información del ticket
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50), -- technical, billing, information, complaint
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, critical
    
    -- Asignación y seguimiento
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, waiting, resolved, closed
    assigned_to UUID REFERENCES auth.users(id),
    
    -- SLA (Service Level Agreement)
    due_date TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id), -- Puede ser admin o cliente
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentarios/respuestas del ticket
CREATE TABLE ticket_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- true = nota interna, false = visible para cliente
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Adjuntos del ticket
CREATE TABLE ticket_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size INTEGER,
    file_type VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX idx_tickets_customer ON support_tickets(customer_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX idx_tickets_created ON support_tickets(created_at);
```

### FASE 4: Sistema de Usuarios/Roles

```sql
-- Extender metadata de usuarios existentes
-- En Supabase, esto se hace en auth.users.raw_user_meta_data
-- Estructura sugerida:
{
    "role": "admin" | "technician" | "customer",
    "customer_id": "uuid", -- Si es cliente
    "permissions": ["manage_customers", "create_orders", "view_tickets"]
}

-- Tabla de permisos (opcional, para granularidad)
CREATE TABLE user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id)
);
```

---

## 🎨 Estructura de Rutas (SvelteKit)

```
src/routes/
├── admin/
│   ├── +page.svelte                    # Dashboard principal
│   ├── clientes/                       # FASE 1
│   │   ├── +page.svelte               # Lista de clientes
│   │   ├── nuevo/
│   │   │   └── +page.svelte           # Crear cliente
│   │   └── [id]/
│   │       ├── +page.svelte           # Perfil del cliente
│   │       └── editar/
│   │           └── +page.svelte       # Editar cliente
│   ├── cotizaciones/                   # YA IMPLEMENTADO
│   │   └── +page.svelte
│   ├── servicios/                      # FASE 2
│   │   ├── +page.svelte               # Lista/Calendario de servicios
│   │   ├── nuevo/
│   │   │   └── +page.svelte           # Crear orden de servicio
│   │   └── [id]/
│   │       ├── +page.svelte           # Detalle de orden
│   │       └── completar/
│   │           └── +page.svelte       # Completar orden (fotos, firma)
│   └── soporte/                        # FASE 3
│       ├── +page.svelte               # Kanban de tickets
│       ├── nuevo/
│       │   └── +page.svelte           # Crear ticket
│       └── [id]/
│           └── +page.svelte           # Detalle de ticket
│
├── portal/                             # FASE 4 (Para clientes)
│   ├── +layout.svelte                 # Layout del portal
│   ├── +page.svelte                   # Dashboard del cliente
│   ├── cotizaciones/
│   │   └── +page.svelte               # Historial de cotizaciones
│   ├── ordenes/
│   │   └── +page.svelte               # Mis órdenes de servicio
│   ├── tickets/
│   │   ├── +page.svelte               # Mis tickets
│   │   └── nuevo/
│   │       └── +page.svelte           # Crear ticket
│   └── perfil/
│       └── +page.svelte               # Editar perfil
│
└── api/
    ├── customers/
    │   └── +server.ts                 # API de clientes
    ├── service-orders/
    │   └── +server.ts                 # API de órdenes
    └── tickets/
        └── +server.ts                 # API de tickets
```

---

## 🔧 Componentes Reutilizables

### FASE 1: CRM
```
src/lib/components/
├── customers/
│   ├── CustomerSearch.svelte          # Búsqueda de clientes
│   ├── CustomerCard.svelte            # Card de cliente
│   ├── CustomerForm.svelte            # Formulario de cliente
│   └── CustomerQuickAdd.svelte        # Modal rápido de agregar cliente
```

### FASE 2: Servicios
```
src/lib/components/
├── services/
│   ├── ServiceCalendar.svelte         # Calendario de servicios
│   ├── ServiceOrderCard.svelte        # Card de orden
│   ├── ServiceOrderForm.svelte        # Formulario de orden
│   ├── TechnicianAssign.svelte        # Asignar técnico
│   ├── PhotoUploader.svelte           # Subir fotos
│   └── SignaturePad.svelte            # Captura de firma
```

### FASE 3: Helpdesk
```
src/lib/components/
├── tickets/
│   ├── TicketKanban.svelte           # Board estilo Trello
│   ├── TicketCard.svelte             # Card de ticket
│   ├── TicketForm.svelte             # Formulario de ticket
│   ├── TicketComments.svelte         # Sistema de comentarios
│   └── TicketMetrics.svelte          # Métricas y reportes
```

---

## 📝 Guías de Implementación por Fase

### FASE 1: Base de Datos de Clientes

#### Paso 1.1: Crear Tabla en Supabase
```bash
# Ejecutar migration
psql -h db.ugxuhfmjxvhglswxspiv.supabase.co \
     -U postgres \
     -d postgres \
     -f database/migrations/create_customers_table.sql
```

#### Paso 1.2: Crear Página de Clientes
- Archivo: `src/routes/admin/clientes/+page.svelte`
- Funcionalidad: Lista con búsqueda, filtros, y acciones CRUD

#### Paso 1.3: Componente de Búsqueda
- Archivo: `src/lib/components/customers/CustomerSearch.svelte`
- Usar en cotizaciones para autocompletar datos

#### Paso 1.4: Integración con Cotizaciones
- Modificar `/admin/cotizaciones/+page.svelte`
- Agregar botón "Buscar Cliente Existente"
- Autocompletar datos al seleccionar cliente

#### Paso 1.5: Agregar al Dashboard
- Modificar `/admin/+page.svelte`
- Agregar card "Clientes" con estadísticas

---

### FASE 2: Órdenes de Servicio

#### Paso 2.1: Crear Tablas
```bash
# Ejecutar migrations
database/migrations/create_service_orders.sql
```

#### Paso 2.2: Crear Página de Servicios
- Implementar calendario con vista mensual/semanal
- Lista de órdenes con filtros por estado

#### Paso 2.3: Workflow de Estados
- Pending → Scheduled → In Progress → Completed
- Notificaciones automáticas en cada cambio

#### Paso 2.4: Completar Orden
- Página especial para completar orden
- Subir fotos antes/después
- Capturar firma del cliente
- Registrar materiales usados

---

### FASE 3: Sistema de Tickets

#### Paso 3.1: Crear Tablas
```bash
database/migrations/create_support_tickets.sql
```

#### Paso 3.2: Kanban Board
- Implementar drag & drop entre columnas
- Open → In Progress → Waiting → Resolved → Closed

#### Paso 3.3: Sistema de Comentarios
- Comentarios públicos vs notas internas
- Notificaciones por email

#### Paso 3.4: Métricas
- Tiempo promedio de respuesta
- Tickets por categoría
- Satisfacción del cliente

---

## 🔐 Sistema de Permisos

```typescript
// src/lib/auth/permissions.ts

export const ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    TECHNICIAN: 'technician',
    CUSTOMER: 'customer'
} as const;

export const PERMISSIONS = {
    // Clientes
    VIEW_CUSTOMERS: 'view_customers',
    CREATE_CUSTOMERS: 'create_customers',
    EDIT_CUSTOMERS: 'edit_customers',
    DELETE_CUSTOMERS: 'delete_customers',
    
    // Cotizaciones
    VIEW_QUOTATIONS: 'view_quotations',
    CREATE_QUOTATIONS: 'create_quotations',
    EDIT_QUOTATIONS: 'edit_quotations',
    DELETE_QUOTATIONS: 'delete_quotations',
    SEND_QUOTATIONS: 'send_quotations',
    
    // Órdenes de servicio
    VIEW_SERVICE_ORDERS: 'view_service_orders',
    CREATE_SERVICE_ORDERS: 'create_service_orders',
    EDIT_SERVICE_ORDERS: 'edit_service_orders',
    ASSIGN_SERVICE_ORDERS: 'assign_service_orders',
    COMPLETE_SERVICE_ORDERS: 'complete_service_orders',
    
    // Tickets
    VIEW_ALL_TICKETS: 'view_all_tickets',
    VIEW_OWN_TICKETS: 'view_own_tickets',
    CREATE_TICKETS: 'create_tickets',
    ASSIGN_TICKETS: 'assign_tickets',
    RESOLVE_TICKETS: 'resolve_tickets',
    VIEW_INTERNAL_NOTES: 'view_internal_notes'
} as const;

export const ROLE_PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
    
    [ROLES.ADMIN]: [
        PERMISSIONS.VIEW_CUSTOMERS,
        PERMISSIONS.CREATE_CUSTOMERS,
        PERMISSIONS.EDIT_CUSTOMERS,
        PERMISSIONS.VIEW_QUOTATIONS,
        PERMISSIONS.CREATE_QUOTATIONS,
        PERMISSIONS.EDIT_QUOTATIONS,
        PERMISSIONS.SEND_QUOTATIONS,
        PERMISSIONS.VIEW_SERVICE_ORDERS,
        PERMISSIONS.CREATE_SERVICE_ORDERS,
        PERMISSIONS.EDIT_SERVICE_ORDERS,
        PERMISSIONS.ASSIGN_SERVICE_ORDERS,
        PERMISSIONS.VIEW_ALL_TICKETS,
        PERMISSIONS.CREATE_TICKETS,
        PERMISSIONS.ASSIGN_TICKETS,
        PERMISSIONS.RESOLVE_TICKETS,
        PERMISSIONS.VIEW_INTERNAL_NOTES
    ],
    
    [ROLES.TECHNICIAN]: [
        PERMISSIONS.VIEW_CUSTOMERS,
        PERMISSIONS.VIEW_QUOTATIONS,
        PERMISSIONS.VIEW_SERVICE_ORDERS,
        PERMISSIONS.COMPLETE_SERVICE_ORDERS,
        PERMISSIONS.VIEW_ALL_TICKETS,
        PERMISSIONS.CREATE_TICKETS
    ],
    
    [ROLES.CUSTOMER]: [
        PERMISSIONS.VIEW_OWN_TICKETS,
        PERMISSIONS.CREATE_TICKETS
    ]
};
```

---

## 📊 Métricas y KPIs

### Dashboard Principal (FASE 1)
```typescript
// Métricas a mostrar
interface DashboardMetrics {
    // Clientes
    totalCustomers: number;
    newCustomersThisMonth: number;
    
    // Cotizaciones
    totalQuotations: number;
    quotationsThisMonth: number;
    conversionRate: number; // % que se convierten en ventas
    
    // Ventas (futuro)
    totalRevenue: number;
    revenueThisMonth: number;
}
```

### Dashboard de Servicios (FASE 2)
```typescript
interface ServiceMetrics {
    pendingOrders: number;
    scheduledToday: number;
    inProgress: number;
    completedThisMonth: number;
    averageCompletionTime: number; // horas
    customerSatisfactionAvg: number; // 1-5
}
```

### Dashboard de Soporte (FASE 3)
```typescript
interface SupportMetrics {
    openTickets: number;
    avgFirstResponseTime: number; // minutos
    avgResolutionTime: number; // horas
    ticketsByCategory: Record<string, number>;
    satisfactionScore: number;
}
```

---

## 🎨 Diseño y UX

### Paleta de Colores (basada en el sistema actual)
```css
:root {
    /* Primarios */
    --red-primary: #DC2626;
    --blue-primary: #2563EB;
    
    /* Estados */
    --status-pending: #F59E0B;    /* Amber */
    --status-progress: #3B82F6;   /* Blue */
    --status-completed: #10B981;  /* Green */
    --status-cancelled: #EF4444;  /* Red */
    
    /* Prioridades */
    --priority-low: #6B7280;      /* Gray */
    --priority-normal: #3B82F6;   /* Blue */
    --priority-high: #F59E0B;     /* Amber */
    --priority-urgent: #EF4444;   /* Red */
}
```

### Iconos Sugeridos
```typescript
// Usar lucide-svelte o heroicons
const ICONS = {
    customer: 'User',
    quotation: 'FileText',
    service: 'Wrench',
    ticket: 'MessageSquare',
    calendar: 'Calendar',
    photo: 'Camera',
    signature: 'PenTool',
    notification: 'Bell'
};
```

---

## 🔔 Sistema de Notificaciones

### Eventos que Generan Notificaciones

```typescript
enum NotificationEvent {
    // Cotizaciones
    QUOTATION_CREATED = 'quotation.created',
    QUOTATION_SENT = 'quotation.sent',
    
    // Órdenes de servicio
    SERVICE_ORDER_CREATED = 'service_order.created',
    SERVICE_ORDER_ASSIGNED = 'service_order.assigned',
    SERVICE_ORDER_SCHEDULED = 'service_order.scheduled',
    SERVICE_ORDER_COMPLETED = 'service_order.completed',
    
    // Tickets
    TICKET_CREATED = 'ticket.created',
    TICKET_ASSIGNED = 'ticket.assigned',
    TICKET_COMMENTED = 'ticket.commented',
    TICKET_RESOLVED = 'ticket.resolved'
}
```

### Canales de Notificación
1. **Email** (Resend) - Ya implementado
2. **In-app** (Notificaciones en la aplicación)
3. **WhatsApp** (Fase avanzada - API de WhatsApp Business)
4. **SMS** (Opcional - Twilio)

---

## 📱 Responsividad

### Prioridades por Dispositivo

**Desktop (Principal):**
- Gestión completa de clientes
- Creación y edición de cotizaciones
- Dashboard con métricas
- Administración de tickets

**Tablet:**
- Visualización de órdenes de servicio
- Calendario de servicios
- Firma digital en órdenes

**Mobile:**
- App para técnicos en campo
- Subir fotos de servicios
- Ver órdenes asignadas
- Actualizar estados

---

## 🧪 Testing

### Casos de Prueba por Fase

**FASE 1: Clientes**
- [ ] Crear cliente nuevo
- [ ] Buscar cliente existente
- [ ] Editar información de cliente
- [ ] Autocompletar en cotización
- [ ] Validar campos requeridos
- [ ] Evitar emails duplicados

**FASE 2: Servicios**
- [ ] Crear orden de servicio
- [ ] Asignar técnico
- [ ] Cambiar estados
- [ ] Subir fotos
- [ ] Capturar firma
- [ ] Generar reporte PDF

**FASE 3: Tickets**
- [ ] Crear ticket
- [ ] Agregar comentarios
- [ ] Adjuntar archivos
- [ ] Cambiar prioridad
- [ ] Asignar a técnico
- [ ] Cerrar ticket

---

## 🚀 Roadmap de Implementación

### Mes 1: FASE 1 (Clientes)
- **Semana 1**: Base de datos y migrations
- **Semana 2**: CRUD de clientes + búsqueda
- **Semana 3**: Integración con cotizaciones
- **Semana 4**: Testing y refinamiento

### Mes 2: FASE 2 (Servicios)
- **Semana 1**: Base de datos y estructura
- **Semana 2**: Creación y gestión de órdenes
- **Semana 3**: Calendario y asignaciones
- **Semana 4**: Completar órdenes (fotos/firma)

### Mes 3: FASE 3 (Helpdesk)
- **Semana 1**: Base de datos de tickets
- **Semana 2**: Kanban board y comentarios
- **Semana 3**: Notificaciones y adjuntos
- **Semana 4**: Métricas y reportes

### Mes 4-6: FASE 4 (Portal Clientes)
- Sistema de autenticación
- Portal web para clientes
- Auto-registro y gestión

### Mes 7+: FASE 5 (Avanzado)
- Automatizaciones
- Integraciones externas
- App móvil nativa

---

## 📚 Documentos de Referencia

Este plan maestro debe complementarse con documentos específicos por fase:

1. **CRM_IMPLEMENTATION.md** - Guía detallada FASE 1
2. **FSM_IMPLEMENTATION.md** - Guía detallada FASE 2
3. **HELPDESK_IMPLEMENTATION.md** - Guía detallada FASE 3
4. **PORTAL_IMPLEMENTATION.md** - Guía detallada FASE 4

---

## 🎯 Próximos Pasos Inmediatos

### Para empezar HOY con FASE 1:

1. **Crear migration de clientes**:
   ```bash
   # Archivo: database/migrations/create_customers_table.sql
   ```

2. **Generar tipos TypeScript**:
   ```bash
   supabase gen types typescript --project-id ugxuhfmjxvhglswxspiv > src/lib/types/database.types.ts
   ```

3. **Crear página de clientes**:
   ```bash
   # Archivo: src/routes/admin/clientes/+page.svelte
   ```

4. **Componente de búsqueda**:
   ```bash
   # Archivo: src/lib/components/customers/CustomerSearch.svelte
   ```

5. **Integrar con cotizaciones**:
   - Modificar `/admin/cotizaciones/+page.svelte`
   - Agregar selector de cliente existente

---

## 💡 Notas Importantes

- ✅ **Incremental**: Cada fase es funcional e independiente
- ✅ **Escalable**: Arquitectura preparada para crecimiento
- ✅ **Mantenible**: Documentación completa en cada paso
- ✅ **Testeable**: Casos de prueba definidos por fase
- ✅ **Flexible**: Fácil agregar funcionalidades nuevas

---

## 🤝 Convenciones de Código

### Nomenclatura
- **Tablas**: snake_case (customers, service_orders)
- **Componentes**: PascalCase (CustomerCard.svelte)
- **Funciones**: camelCase (createCustomer())
- **Constantes**: SCREAMING_SNAKE_CASE (DEFAULT_STATUS)

### Estructura de Archivos
```
feature/
├── +page.svelte          # Vista principal
├── +page.ts              # Load data
├── +server.ts            # API endpoint
└── components/           # Componentes específicos
```

### Commits
```bash
# Formato: [FASE-X] Descripción clara
[FASE-1] Add customers table migration
[FASE-1] Create customer search component
[FASE-2] Implement service order calendar
```

---

**Versión**: 1.0  
**Última actualización**: Enero 2026  
**Estado**: 🟢 Activo  
**Siguiente revisión**: Después de completar FASE 1
