# Asistente IA — Guerra Láser

Plataforma interna de inteligencia operativa: chat técnico con RAG, cotizaciones abiertas y app móvil.

## Setup inicial

### 1. Migración SQL

Ejecuta en Supabase SQL Editor:

```
database/migrations/20260624000000_create_ai_knowledge_base.sql
```

Crea también el bucket de Storage `ai-chat-attachments` (privado) en Supabase Dashboard.

### 2. Token móvil (APK)

```bash
yarn token:mobile
```

Copia el token a `.env`:

```
PUBLIC_MOBILE_APP_TOKEN=gl_mob_...
```

### 3. Seed catálogo → base de conocimientos

```bash
npx tsx scripts/seed-knowledge-from-catalog.ts
```

## Rutas

| Ruta | Acceso |
|------|--------|
| `/admin/asistente` | Web — login Supabase + permiso `use_ai_assistant` |
| `/admin/asistente/dispositivos` | Gestión token móvil |
| `/mobile/asistente` | App Capacitor — token embebido + selector de miembro |

## API

- `POST /api/ai/chat` — chat conocimiento
- `POST /api/ai/knowledge` — guardar artículo KB
- `POST /api/ai/quote/parse` — borrador cotización
- `POST /api/ai/quote/format` — texto WhatsApp
- `POST /api/ai/quote/pdf` — PDF formal bajo demanda
- `POST /api/ai/upload` — adjuntos
- `GET /api/ai/team-members` — selector móvil

Auth web: `Authorization: Bearer <jwt>`
Auth móvil: `X-App-Token` + opcional `X-Team-Member-Id`

## App Android (Capacitor)

Guía detallada: **[APK_ASISTENTE_IA.md](./APK_ASISTENTE_IA.md)**

```bash
yarn install
yarn token:mobile
yarn apk:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

El APK carga la UI desde Vercel (`capacitor.config.ts` → `server.url`). Usa **Yarn**; no hace falta `npm install --legacy-peer-deps`.
