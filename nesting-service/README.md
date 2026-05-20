# Nesting + trace service (FastAPI)

Servicio de acomodo rectangular (`rectpack`), vectorización de imágenes a DXF/PLT (`opencv` + `ezdxf`) para Guerra Láser.

## Requisitos

- Docker y Docker Compose

## Configuración

1. Copia `.env.example` a `.env` en esta carpeta (o crea `.env`):

```env
NESTING_TOKEN=un-secreto-largo-aleatorio
NESTING_CORS_ORIGINS=http://localhost:5173,https://tu-dominio-vercel.app
```

El mismo valor de `NESTING_TOKEN` debe configurarse en el proyecto SvelteKit como `NESTING_API_TOKEN` (variable privada). Ese mismo URL/token sirve para nesting (`/api/nesting`) y vectorización (`/api/vectorize`).

## Arranque

```bash
cd nesting-service
docker compose up -d --build
```

Puerto host **8002** → contenedor **8081** (uvicorn directo sin compose: **8081**).

## Endpoints

- `GET /health` — sin token (comprobación de vida).
- `POST /nest` — body JSON `NestingRequest`; header `X-Nesting-Token`. Respuesta: `layout`, `unplaced`, `efficiency`, `dxf_base64`, `plt_base64`, etc.
- `POST /generate-dxf` / `POST /generate-plt` — mismo body JSON; archivo directo.
- `POST /trace` — `multipart/form-data`; header `X-Nesting-Token`. Convierte imagen a DXF/PLT para grabado (termos, tarjetas). Con `preview_only=true` devuelve solo vistas previa (máscara + trazos) sin generar archivos.

Campos de `/trace`:

| Campo | Requerido | Default |
|-------|-----------|---------|
| `file` | sí | — |
| `target_width_mm` | sí | — |
| `target_height_mm` | sí | — |
| `threshold` | no | 127 (ignorado si adaptativo) |
| `invert` | no | false |
| `min_area_mm2` | no | 0.5 |
| `simplify_epsilon_mm` | no | 0.05 (máx. 0.1 mm en servidor) |
| `output` | no | both |
| `use_external_only` | no | true |
| `preview_only` | no | false |
| `use_adaptive_threshold` | no | false (logos 3D / sombras) |
| `adaptive_block_size` | no | 21 (impar) |
| `adaptive_c` | no | 5 |

Sin desenfoque Gaussian previo (mejor detalle en texto y logos digitales).

Respuesta: `threshold_mode` (`fixed` | `adaptive`), `contour_count`, `contours_raw`, `contours_kept`, `bbox_mm`, `preview_mask_base64`, `preview_paths_base64` (negro = grabado), `dxf_base64`, `plt_base64`, `warnings`.

## Prueba con curl

Nesting:

```bash
export TOKEN=tu-token
curl -sS -X POST http://localhost:8002/nest \
  -H "Content-Type: application/json" \
  -H "X-Nesting-Token: $TOKEN" \
  -d '{"sheet_width":1220,"sheet_height":2440,"mandatory":[{"width":400,"height":400,"quantity":1}]}' | head -c 200
```

Trace (imagen → DXF/PLT):

```bash
curl -sS -X POST http://localhost:8002/trace \
  -H "X-Nesting-Token: $TOKEN" \
  -F "file=@logo.png" \
  -F "target_width_mm=90" \
  -F "target_height_mm=50" \
  -F "threshold=130" | head -c 300
```

Logo con relieve (umbral adaptativo):

```bash
curl -sS -X POST http://localhost:8002/trace \
  -H "X-Nesting-Token: $TOKEN" \
  -F "file=@logo.png" \
  -F "target_width_mm=90" \
  -F "target_height_mm=50" \
  -F "use_adaptive_threshold=true" \
  -F "min_area_mm2=8" \
  -F "simplify_epsilon_mm=0.05" \
  -F "preview_only=true" | head -c 300
```

Tests locales: `pip install -r requirements.txt && python test_trace.py`

## Proxy reverso

El front SvelteKit usa `/api/nesting` y `/api/vectorize` (no expone el token en el navegador).

## LightBurn

Con líneas compartidas entre piezas, en LightBurn activa **Delete Duplicates** en la optimización de importación/corte.
