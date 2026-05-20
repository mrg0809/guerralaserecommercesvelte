# Vectorize service (FastAPI)

Convierte imágenes raster (logo, foto monocroma) en archivos **DXF** y **PLT** (HPGL) para grabado láser en termos, tarjetas, etc. (RDWorks / Ruida).

## Requisitos

- Docker y Docker Compose

## Configuración

1. Copia `.env.example` a `.env` en esta carpeta:

```env
VECTORIZE_TOKEN=un-secreto-largo-aleatorio
VECTORIZE_CORS_ORIGINS=http://localhost:5173,https://tu-dominio.app
```

El mismo valor debe configurarse en SvelteKit como `VECTORIZE_API_TOKEN`.

## Arranque

```bash
cd vectorize-service
docker compose up -d --build
```

Puerto host: **8003** → contenedor **8082**.

## Endpoints

- `GET /health` — sin token.
- `POST /trace` — `multipart/form-data`; header `X-Vectorize-Token`.

Campos del formulario:

| Campo | Requerido | Default |
|-------|-----------|---------|
| `file` | sí | — |
| `target_width_mm` | sí | — |
| `target_height_mm` | sí | — |
| `threshold` | no | 127 |
| `invert` | no | false |
| `min_area_mm2` | no | 0.5 |
| `simplify_epsilon_mm` | no | 0.3 |
| `output` | no | both (`both`, `dxf`, `plt`) |
| `use_external_only` | no | true |

Respuesta: `contour_count`, `bbox_mm`, `dxf_base64`, `plt_base64`, `warnings`.

## Prueba con curl

```bash
export TOKEN=tu-token
curl -sS -X POST http://localhost:8003/trace \
  -H "X-Vectorize-Token: $TOKEN" \
  -F "file=@logo.png" \
  -F "target_width_mm=90" \
  -F "target_height_mm=50" \
  -F "threshold=130" | head -c 300
```

## Integración web

El front usa el proxy SvelteKit `/api/vectorize` (no expone el token). Ver `/admin/vectorize`.
