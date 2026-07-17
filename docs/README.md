# Documentación — Guerra Láser Ecommerce

Índice central de la documentación técnica del proyecto. El [README principal](../README.md) cubre instalación básica y estructura general.

---

## Administración

| Documento | Descripción |
|-----------|-------------|
| [Roles y permisos](./admin/roles-y-permisos.md) | Sistema de roles, permisos y políticas RLS |
| [Usuarios](./admin/usuarios.md) | Gestión de usuarios y creación de cuentas |
| [Clientes](./admin/clientes.md) | Módulo CRM de clientes (Fase 1) |

## CRM

| Documento | Descripción |
|-----------|-------------|
| [Plan maestro CRM/Helpdesk](./crm/masterplan.md) | Roadmap completo del sistema CRM, FSM y Helpdesk |

## Productos

| Documento | Descripción |
|-----------|-------------|
| [PIM (Amazon / ML / SAT)](./productos/pim.md) | Product Information Management multi-canal |
| [Especificaciones](./productos/especificaciones.md) | Atributos técnicos de productos |
| [Imágenes y almacenamiento](./productos/imagenes-y-almacenamiento.md) | Bucket Supabase, políticas RLS e imágenes |
| [Bundles](./productos/bundles.md) | Paquetes de productos |
| [Variantes de acrílico](./productos/variantes-acrilico.md) | Selector color/grosor/tamaño |

## Envíos

| Documento | Descripción |
|-----------|-------------|
| [Sistema de envíos](./envios/sistema-envios.md) | Tipos de envío, checkout y envíos personalizados |

## Integraciones

| Documento | Descripción |
|-----------|-------------|
| [Google Analytics](./integraciones/google-analytics.md) | gtag.js y eventos personalizados |
| [Email](./integraciones/email.md) | Envío de cotizaciones por correo (Resend, etc.) |
| [Envia.com + Stripe (legacy)](./integraciones/envia-stripe-legacy.md) | Integración deprecada — referencia histórica |

## Cotizaciones

| Documento | Descripción |
|-----------|-------------|
| [Sistema de cotizaciones](./cotizaciones/cotizaciones.md) | Creación, gestión y PDF de cotizaciones |

## Asistente IA

| Documento | Descripción |
|-----------|-------------|
| [Asistente IA](./asistente-ia/asistente.md) | Setup, rutas API y mejoras con Gemini |
| [APK móvil](./asistente-ia/apk-movil.md) | Build e instalación de la app Android |

## Contenido

| Documento | Descripción |
|-----------|-------------|
| [Carrusel de videos](./contenido/carrusel-videos.md) | Testimonios en YouTube/TikTok |

## Servicios

| Documento | Descripción |
|-----------|-------------|
| [Nesting Service](../nesting-service/README.md) | API FastAPI de nesting, vectorización y DXF |

---

## Estructura de carpetas

```
docs/
├── README.md                 ← Estás aquí
├── admin/                    # Panel de administración
├── crm/                      # Plan maestro CRM
├── productos/                # Catálogo, PIM, media
├── envios/                   # Logística y checkout
├── integraciones/            # Servicios externos
├── cotizaciones/             # Cotizaciones comerciales
├── asistente-ia/             # Chat IA y app móvil
└── contenido/                # Contenido del frontend
```
