"""
Raster image → DXF + HPGL PLT for laser engraving (termos, tarjetas, RDWorks/Ruida).
Used by POST /trace in main.py.
"""

from __future__ import annotations

import base64
import io
from typing import Any

import cv2
import ezdxf
import numpy as np
from fastapi import HTTPException

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


def parse_bool(value: str | None, default: bool = False) -> bool:
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


def _clamp_simplify_mm(value: float) -> float:
    """Máximo 0.1 mm para no colapsar letras pequeñas en approxPolyDP."""
    return min(max(0.0, value), 0.1)


def _binarize(
    gray: np.ndarray,
    threshold: int,
    invert: bool,
    *,
    use_adaptive_threshold: bool = False,
    adaptive_block_size: int = 21,
    adaptive_c: int = 5,
) -> np.ndarray:
    thresh_type = cv2.THRESH_BINARY_INV if invert else cv2.THRESH_BINARY
    if use_adaptive_threshold:
        bs = adaptive_block_size | 1
        if bs < 3:
            bs = 3
        return cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            thresh_type,
            bs,
            adaptive_c,
        )
    _, binary = cv2.threshold(gray, threshold, 255, thresh_type)
    return binary


def _filter_contours(
    binary: np.ndarray,
    *,
    min_area_mm2: float,
    simplify_epsilon_mm: float,
    target_w_mm: float,
    target_h_mm: float,
    use_external_only: bool,
) -> tuple[list[np.ndarray], list[str], int]:
    """Returns (filtered contours, warnings, raw_contour_count)."""
    warnings: list[str] = []
    mode = cv2.RETR_EXTERNAL if use_external_only else cv2.RETR_LIST
    found = cv2.findContours(binary, mode, cv2.CHAIN_APPROX_SIMPLE)
    contours = found[0] if len(found) == 2 else found[1]
    raw_count = len(contours)

    h, w = binary.shape[:2]
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

    if raw_count > 500:
        warnings.append(f"Muchos contornos detectados ({raw_count}); sube umbral o área mínima")
    if len(filtered) > 200:
        warnings.append(f"Tras filtrar quedan {len(filtered)} trazos; sube área mínima o simplificación")
    if len(filtered) == 0:
        warnings.append("Ningún trazo válido; prueba otro umbral, invierte o baja el área mínima")

    return filtered, warnings, raw_count


def _encode_png_b64(gray_or_bgr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", gray_or_bgr)
    if not ok:
        raise HTTPException(status_code=500, detail="No se pudo generar la vista previa")
    return base64.b64encode(bytes(buf)).decode("ascii")


def _build_previews(
    binary: np.ndarray,
    contours: list[np.ndarray],
) -> dict[str, str]:
    """
    mask: negro = zona detectada para trazar (antes de filtrar por área).
    paths: negro = líneas que irán al DXF/PLT (tras filtro y simplificación).
    """
    h, w = binary.shape[:2]
    mask_vis = np.full((h, w), 255, dtype=np.uint8)
    mask_vis[binary == 255] = 0

    paths_vis = np.full((h, w), 255, dtype=np.uint8)
    if contours:
        cv2.drawContours(paths_vis, contours, -1, 0, 1, lineType=cv2.LINE_AA)

    return {
        "preview_mask_base64": _encode_png_b64(mask_vis),
        "preview_paths_base64": _encode_png_b64(paths_vis),
    }


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


def _build_trace_dxf(
    polylines: list[list[tuple[float, float]]], target_w_mm: float, target_h_mm: float
) -> str:
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


def _build_trace_plt(polylines: list[list[tuple[float, float]]]) -> str:
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


def _process_image(
    image_bytes: bytes,
    *,
    target_width_mm: float,
    target_height_mm: float,
    threshold: int,
    invert: bool,
    min_area_mm2: float,
    simplify_epsilon_mm: float,
    use_external_only: bool,
    use_adaptive_threshold: bool = False,
    adaptive_block_size: int = 21,
    adaptive_c: int = 5,
) -> tuple[np.ndarray, np.ndarray, list[np.ndarray], list[str], int, str]:
    if target_width_mm <= 0 or target_height_mm <= 0:
        raise HTTPException(status_code=400, detail="target_width_mm y target_height_mm deben ser > 0")
    if not use_adaptive_threshold and not 0 <= threshold <= 255:
        raise HTTPException(status_code=400, detail="threshold debe estar entre 0 y 255")

    simplify_epsilon_mm = _clamp_simplify_mm(simplify_epsilon_mm)
    threshold_mode = "adaptive" if use_adaptive_threshold else "fixed"

    gray = _decode_image(image_bytes)
    gray = _resize_max(gray, MAX_PIXELS)
    binary = _binarize(
        gray,
        threshold,
        invert,
        use_adaptive_threshold=use_adaptive_threshold,
        adaptive_block_size=adaptive_block_size,
        adaptive_c=adaptive_c,
    )
    filtered, warnings, raw_count = _filter_contours(
        binary,
        min_area_mm2=min_area_mm2,
        simplify_epsilon_mm=simplify_epsilon_mm,
        target_w_mm=target_width_mm,
        target_h_mm=target_height_mm,
        use_external_only=use_external_only,
    )
    return gray, binary, filtered, warnings, raw_count, threshold_mode


def run_preview(
    image_bytes: bytes,
    *,
    target_width_mm: float,
    target_height_mm: float,
    threshold: int,
    invert: bool,
    min_area_mm2: float,
    simplify_epsilon_mm: float,
    use_external_only: bool,
    use_adaptive_threshold: bool = False,
    adaptive_block_size: int = 21,
    adaptive_c: int = 5,
) -> dict[str, Any]:
    _gray, binary, filtered, warnings, raw_count, threshold_mode = _process_image(
        image_bytes,
        target_width_mm=target_width_mm,
        target_height_mm=target_height_mm,
        threshold=threshold,
        invert=invert,
        min_area_mm2=min_area_mm2,
        simplify_epsilon_mm=simplify_epsilon_mm,
        use_external_only=use_external_only,
        use_adaptive_threshold=use_adaptive_threshold,
        adaptive_block_size=adaptive_block_size,
        adaptive_c=adaptive_c,
    )
    polylines = _contours_to_mm_polylines(filtered, target_width_mm, target_height_mm)
    previews = _build_previews(binary, filtered)

    return {
        "preview_only": True,
        "threshold_mode": threshold_mode,
        "contour_count": len(polylines),
        "contours_raw": raw_count,
        "contours_kept": len(filtered),
        "bbox_mm": _bbox_mm(polylines),
        "target_mm": {"width": target_width_mm, "height": target_height_mm},
        "warnings": warnings,
        **previews,
    }


def run_trace(
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
    include_preview: bool = True,
    use_adaptive_threshold: bool = False,
    adaptive_block_size: int = 21,
    adaptive_c: int = 5,
) -> dict[str, Any]:
    _gray, binary, filtered, warnings, raw_count, threshold_mode = _process_image(
        image_bytes,
        target_width_mm=target_width_mm,
        target_height_mm=target_height_mm,
        threshold=threshold,
        invert=invert,
        min_area_mm2=min_area_mm2,
        simplify_epsilon_mm=simplify_epsilon_mm,
        use_external_only=use_external_only,
        use_adaptive_threshold=use_adaptive_threshold,
        adaptive_block_size=adaptive_block_size,
        adaptive_c=adaptive_c,
    )
    polylines = _contours_to_mm_polylines(filtered, target_width_mm, target_height_mm)

    result: dict[str, Any] = {
        "threshold_mode": threshold_mode,
        "contour_count": len(polylines),
        "contours_raw": raw_count,
        "contours_kept": len(filtered),
        "bbox_mm": _bbox_mm(polylines),
        "target_mm": {"width": target_width_mm, "height": target_height_mm},
        "warnings": warnings,
    }

    if include_preview:
        result.update(_build_previews(binary, filtered))

    out = output.strip().lower()
    if out in ("both", "dxf", ""):
        dxf_str = _build_trace_dxf(polylines, target_width_mm, target_height_mm)
        result["dxf_base64"] = base64.b64encode(dxf_str.encode("utf-8")).decode("ascii")
    if out in ("both", "plt", ""):
        plt_str = _build_trace_plt(polylines)
        result["plt_base64"] = base64.b64encode(plt_str.encode("utf-8")).decode("ascii")

    return result
