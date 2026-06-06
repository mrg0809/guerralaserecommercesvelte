# Nesting + trace service (FastAPI)

Servicio de acomodo rectangular (`rectpack`), vectorización de imágenes a DXF/PLT (`opencv` + `ezdxf`) y constructor visual SVG→DXF (`Inkscape`) para Guerra Láser.

## Requisitos

- Docker y Docker Compose

## Configuración

1. Copia `.env.example` a `.env` en esta carpeta (o crea `.env`):

```env
NESTING_TOKEN=un-secreto-largo-aleatorio
NESTING_CORS_ORIGINS=http://localhost:5173,https://tu-dominio-vercel.app
```

El mismo valor de `NESTING_TOKEN` debe configurarse en el proyecto SvelteKit como `NESTING_API_TOKEN` (variable privada). Ese mismo URL/token sirve para nesting (`/api/nesting`), vectorización (`/api/vectorize`) y constructor de diseños (`/api/design-builder/export-dxf`).

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
- `POST /api/v1/vector/export-dxf` — body JSON `{ svg, width_mm, height_mm, filename? }`; header `X-Nesting-Token`. Convierte SVG del constructor visual a DXF (Inkscape + capa ENGRAVE negra).

Campos de `/api/v1/vector/export-dxf`:

| Campo | Requerido | Default |
|-------|-----------|---------|
| `svg` | sí | — |
| `width_mm` | sí | — |
| `height_mm` | sí | — |
| `filename` | no | diseno_guerra_laser.dxf |

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

## DXF/PLT y RDWorks

- Aristas únicas (`LINE` en DXF): bordes compartidos entre piezas van una sola vez.
- No se exportan líneas donde una pieza coincide con el borde del material, salvo que actives `include_sheet_outline`.
- **Sobrecorte** (`cut_overhang_mm`, default 5): los cortes horizontales internos se alargan de `-overhang` a `ancho + overhang`; el resto de líneas se extienden solo hacia vacío. Así el láser abre la hoja aunque la pieza no llegue al borde derecho del desperdicio.

### Origen en RDWorks (recomendado)

1. Define el **origen de usuario** en la esquina interna de la escuadra física (coincide con `(0,0)` del DXF).
2. **No muevas** el origen manualmente en el panel de la máquina entre trabajos.
3. Coloca la plancha al tope de la escuadra y usa el sobrecorte configurado (ajusta 3–5 mm si hace falta).
