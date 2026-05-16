# Nesting service (FastAPI)

Servicio de acomodo rectangular (`rectpack`) y exportación DXF (`ezdxf`) para Guerra Láser.

## Requisitos

- Docker y Docker Compose

## Configuración

1. Copia `.env.example` a `.env` en esta carpeta (o crea `.env`):

```env
NESTING_TOKEN=un-secreto-largo-aleatorio
NESTING_CORS_ORIGINS=http://localhost:5173,https://tu-dominio-vercel.app
```

El mismo valor de `NESTING_TOKEN` debe configurarse en el proyecto SvelteKit como `NESTING_API_TOKEN` (variable privada).

## Arranque

```bash
cd nesting-service
docker compose up -d --build
```

Puerto: **8081**.

## Endpoints

- `GET /health` — sin token (comprobación de vida).
- `POST /nest` — body JSON `NestingRequest`; header `X-Nesting-Token: <NESTING_TOKEN>`. Respuesta: `layout`, `unplaced`, `efficiency`, `waste_area_mm2`, `waste_percent`, `void_regions`, `all_mandatory_placed`, `dxf_base64`, `plt_base64`, `sheet`. Las obligatorias se empaquetan primero (varias heurísticas MaxRects); el stock solo entra en huecos libres si caben todas las obligatorias.
- `POST /generate-dxf` — mismo body; devuelve el archivo `.dxf` directamente.
- `POST /generate-plt` — mismo body; devuelve el archivo `.plt` (HPGL) para RDWorks.

## Prueba con curl

```bash
export TOKEN=tu-token
curl -sS -X POST http://localhost:8081/nest \
  -H "Content-Type: application/json" \
  -H "X-Nesting-Token: $TOKEN" \
  -d '{"sheet_width":1220,"sheet_height":2440,"mandatory":[{"width":400,"height":400,"quantity":1}],"stock_options":[{"width":200,"height":200,"quantity":20}]}' | head -c 200
```

## Proxy reverso

En producción suele exponerse detrás de Nginx/Caddy junto a Seafile o Chatwoot; el front SvelteKit habla con el servicio vía URL interna o HTTPS usando el proxy de SvelteKit (`/api/nesting`) para no exponer el token en el navegador.

## LightBurn

Con líneas compartidas entre piezas, en LightBurn activa **Delete Duplicates** en la optimización de importación/corte.
