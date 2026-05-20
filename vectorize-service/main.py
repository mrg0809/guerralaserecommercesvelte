"""
Vectorize service: raster image → DXF + HPGL PLT for laser engraving (RDWorks/Ruida).
Auth: header X-Vectorize-Token must match env VECTORIZE_TOKEN.
"""

from __future__ import annotations

import base64
import io
import os
from typing import Any

import cv2
import ezdxf
import numpy as np
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Guerra Láser Vectorize", version="1.0.0")

_cors = os.getenv(
    "VECTORIZE_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors.split(",") if o.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 2000
UNITS_PER_MM = 40
ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/bmp",
    "image/gif",
    "application/octet-stream",
}


def _verify_token(x_vectorize_token: str | None = Header(default=None)) -> None:
    expected = os.getenv("VECTORIZE_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=500, detail="VECTORIZE_TOKEN no configurado en el servidor")
    if not x_vectorize_token or x_vectorize_token.strip() != expected:
        raise HTTPException(status_code=401, detail="Token inválido")


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise HTTPException(status_code=400, detail="No se pudo decodificar la imagen")
    if len(img.shape) == 3:
        if img.shape[2] == 4:
            alpha = img[:, :, 3]
            rgb = img[:, :, :3]
            gray = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY)
            gray = np.where(alpha < 128, 255, gray)
        else:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img
    return gray


def _resize_max(gray: np.ndarray, max_pixels: int) -> np.ndarray:
    h, w = gray.shape[:2]
    longest = max(h, w)
    if longest <= max_pixels:
        return gray
    scale = max_pixels / longest
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _contours_to_mm_polylines(
    contours: list[np.ndarray],
    target_w_mm: float,
    target_h_mm: float,
) -> list[list[tuple[float, float]]]:
    if not contours:
        return []

    all_pts: list[tuple[float, float]] = []
    for c in contours:
        for p in c.reshape(-1, 2):
            all_pts.append((float(p[0]), float(p[1])))

    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    bw = max(max_x - min_x, 1e-6)
    bh = max(max_y - min_y, 1e-6)

    scale = min(target_w_mm / bw, target_h_mm / bh)
    out_w = bw * scale
    out_h = bh * scale
    offset_x = (target_w_mm - out_w) / 2.0
    offset_y = (target_h_mm - out_h) / 2.0

    polylines: list[list[tuple[float, float]]] = []
    for c in contours:
        pts: list[tuple[float, float]] = []
        for p in c.reshape(-1, 2):
            px = (float(p[0]) - min_x) * scale + offset_x
            py = (float(p[1]) - min_y) * scale + offset_y
            pts.append((px, -py))
        if len(pts) > 2:
            if pts[0] != pts[-1]:
                pts.append(pts[0])
            polylines.append(pts)
    return polylines


def _trace_image(
    gray: np.ndarray,
    *,
    threshold: int,
    invert: bool,
    min_area_mm2: float,
    simplify_epsilon_mm: float,
    target_w_mm: float,
    target_h_mm: float,
    use_external_only: bool,
) -> tuple[list[list[tuple[float, float]]], list[str]]:
    warnings: list[str] = []
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    thresh_type = cv2.THRESH_BINARY_INV if invert else cv2.THRESH_BINARY
    _, binary = cv2.threshold(blurred, threshold, 255, thresh_type)

    mode = cv2.RETR_EXTERNAL if use_external_only else cv2.RETR_LIST
    found = cv2.findContours(binary, mode, cv2.CHAIN_APPROX_SIMPLE)
    contours = found[0] if len(found) == 2 else found[1]

    h, w = gray.shape[:2]
    px_per_mm_x = w / max(target_w_mm, 1e-6)
    px_per_mm_y = h / max(target_h_mm, 1e-6)
    px_per_mm = (px_per_mm_x + px_per_mm_y) / 2.0
    min_area_px = max(1.0, min_area_mm2 * (px_per_mm**2))

    filtered: list[np.ndarray] = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area_px:
            continue
        peri = cv2.arcLength(c, True)
        eps_px = max(0.5, simplify_epsilon_mm * px_per_mm)
        if simplify_epsilon_mm > 0 and peri > 0:
            approx = cv2.approxPolyDP(c, eps_px, True)
            if len(approx) >= 3:
                filtered.append(approx)
        elif len(c) >= 3:
            filtered.append(c)

    if len(filtered) > 500:
        warnings.append("Muchos contornos (>500); sube threshold o min_area_mm2")

    polylines = _contours_to_mm_polylines(filtered, target_w_mm, target_h_mm)
    if not polylines:
        warnings.append("No se generaron contornos; prueba otro umbral o invierte el grabado")

    return polylines, warnings


def _bbox_mm(polylines: list[list[tuple[float, float]]]) -> dict[str, float]:
    if not polylines:
        return {"width": 0.0, "height": 0.0}
    xs: list[float] = []
    ys: list[float] = []
    for pl in polylines:
        for x, y in pl:
            xs.append(x)
            ys.append(y)
    return {
        "width": round(max(xs) - min(xs), 2),
        "height": round(max(ys) - min(ys), 2),
    }


def _build_dxf(polylines: list[list[tuple[float, float]]], target_w_mm: float, target_h_mm: float) -> str:
    doc = ezdxf.new("R2000")
    msp = doc.modelspace()
    msp.add_lwpolyline(
        [(0, 0), (target_w_mm, 0), (target_w_mm, -target_h_mm), (0, -target_h_mm)],
        close=True,
    )
    for pts in polylines:
        if len(pts) > 1:
            msp.add_lwpolyline(pts, close=True)
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue()


def _build_plt(polylines: list[list[tuple[float, float]]]) -> str:
    def u(mm: float) -> int:
        return int(round(mm * UNITS_PER_MM))

    parts: list[str] = ["IN;", "SP1;"]
    for pts in polylines:
        if len(pts) < 2:
            continue
        x0, y0 = u(pts[0][0]), u(pts[0][1])
        coords = ",".join(f"{u(x)},{u(y)}" for x, y in pts[1:])
        parts.append(f"PU{x0},{y0};")
        if coords:
            parts.append(f"PD{coords};")
        parts.append("PU;")
    parts.append("SP0;")
    return "".join(parts)


def _run_trace(
    image_bytes: bytes,
    *,
    target_width_mm: float,
    target_height_mm: float,
    threshold: int,
    invert: bool,
    min_area_mm2: float,
    simplify_epsilon_mm: float,
    output: str,
    use_external_only: bool,
) -> dict[str, Any]:
    if target_width_mm <= 0 or target_height_mm <= 0:
        raise HTTPException(status_code=400, detail="target_width_mm y target_height_mm deben ser > 0")
    if not 0 <= threshold <= 255:
        raise HTTPException(status_code=400, detail="threshold debe estar entre 0 y 255")

    gray = _decode_image(image_bytes)
    gray = _resize_max(gray, MAX_PIXELS)
    polylines, warnings = _trace_image(
        gray,
        threshold=threshold,
        invert=invert,
        min_area_mm2=min_area_mm2,
        simplify_epsilon_mm=simplify_epsilon_mm,
        target_w_mm=target_width_mm,
        target_h_mm=target_height_mm,
        use_external_only=use_external_only,
    )

    result: dict[str, Any] = {
        "contour_count": len(polylines),
        "bbox_mm": _bbox_mm(polylines),
        "target_mm": {"width": target_width_mm, "height": target_height_mm},
        "warnings": warnings,
    }

    out = output.strip().lower()
    if out in ("both", "dxf", ""):
        dxf_str = _build_dxf(polylines, target_width_mm, target_height_mm)
        result["dxf_base64"] = base64.b64encode(dxf_str.encode("utf-8")).decode("ascii")
    if out in ("both", "plt", ""):
        plt_str = _build_plt(polylines)
        result["plt_base64"] = base64.b64encode(plt_str.encode("utf-8")).decode("ascii")

    return result


@app.post("/trace")
async def trace(
    _: None = Depends(_verify_token),
    file: UploadFile = File(...),
    target_width_mm: float = Form(...),
    target_height_mm: float = Form(...),
    threshold: int = Form(127),
    invert: str = Form("false"),
    min_area_mm2: float = Form(0.5),
    simplify_epsilon_mm: float = Form(0.3),
    output: str = Form("both"),
    use_external_only: str = Form("true"),
) -> dict[str, Any]:
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido: {file.content_type}",
        )
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail=f"Imagen demasiado grande (máx {MAX_UPLOAD_BYTES // (1024*1024)} MB)")
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Archivo vacío")

    return _run_trace(
        data,
        target_width_mm=target_width_mm,
        target_height_mm=target_height_mm,
        threshold=threshold,
        invert=_parse_bool(invert, False),
        min_area_mm2=min_area_mm2,
        simplify_epsilon_mm=simplify_epsilon_mm,
        output=output,
        use_external_only=_parse_bool(use_external_only, True),
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
