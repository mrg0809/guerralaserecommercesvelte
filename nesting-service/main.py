"""
Nesting + trace service: rectpack nesting, image→DXF/PLT trace, ezdxf + HPGL (RDWorks).
Auth: header X-Nesting-Token must match env NESTING_TOKEN.

Packing strategy:
1) Place ALL mandatory pieces first (offline pack, try several MaxRects heuristics; prefer MaxRectsBlsf).
2) Only if every mandatory fits, pack stock into remaining free rectangles (multi-bin).
3) If any mandatory is missing, skip stock so filler cannot steal space from obligatorias.
"""

from __future__ import annotations

import base64
import io
import os
from typing import Any

import ezdxf
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from trace import ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES, parse_bool, run_preview, run_trace
from pydantic import BaseModel, Field
from rectpack import SORT_NONE, PackingBin, PackingMode, newPacker
from rectpack.maxrects import MaxRectsBaf, MaxRectsBl, MaxRectsBlsf, MaxRectsBssf  # noqa: F401 — Bl used in void_strategies

app = FastAPI(title="Guerra Láser Nesting + Trace", version="1.1.0")

_cors = os.getenv("NESTING_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors.split(",") if o.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PieceIn(BaseModel):
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    quantity: int = Field(ge=1, le=500)
    label: str | None = None
    variant_id: str | None = None


class NestingRequest(BaseModel):
    sheet_width: float = Field(gt=0)
    sheet_height: float = Field(gt=0)
    mandatory: list[PieceIn] = Field(default_factory=list)
    stock_options: list[PieceIn] = Field(default_factory=list)


def _verify_token(x_nesting_token: str | None = Header(default=None)) -> None:
    expected = os.getenv("NESTING_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=500, detail="NESTING_TOKEN no configurado en el servidor")
    if not x_nesting_token or x_nesting_token.strip() != expected:
        raise HTTPException(status_code=401, detail="Token inválido")


def _subtract_obstacle(
    free_list: list[tuple[float, float, float, float]], obstacle: tuple[float, float, float, float]
) -> list[tuple[float, float, float, float]]:
    """Split axis-aligned free rectangles by removing an obstacle rectangle."""
    ox, oy, ow, oh = obstacle
    ox2, oy2 = ox + ow, oy + oh
    out: list[tuple[float, float, float, float]] = []
    eps = 0.5
    for fx, fy, fw, fh in free_list:
        fx2, fy2 = fx + fw, fy + fh
        ix1, iy1 = max(fx, ox), max(fy, oy)
        ix2, iy2 = min(fx2, ox2), min(fy2, oy2)
        if ix1 >= ix2 or iy1 >= iy2:
            out.append((fx, fy, fw, fh))
            continue
        if iy1 > fy + eps:
            out.append((fx, fy, fw, iy1 - fy))
        if fy2 > iy2 + eps:
            out.append((fx, iy2, fw, fy2 - iy2))
        if ix1 > fx + eps:
            out.append((fx, iy1, ix1 - fx, iy2 - iy1))
        if fx2 > ix2 + eps:
            out.append((ix2, iy1, fx2 - ix2, iy2 - iy1))
    return [(x, y, w, h) for x, y, w, h in out if w > eps and h > eps]


def _rects_overlap(
    ax: float, ay: float, aw: float, ah: float,
    bx: float, by: float, bw: float, bh: float,
    eps: float = 0.5,
) -> bool:
    return ax + aw > bx + eps and ax < bx + bw - eps and ay + ah > by + eps and ay < by + bh - eps


def _piece_fits_void(pw: float, ph: float, vw: float, vh: float) -> bool:
    return (pw <= vw and ph <= vh) or (ph <= vw and pw <= vh)


def _free_rects_from_placed(
    placed_m: list[dict[str, Any]],
    placed_stock: list[dict[str, Any]],
    sheet_w: float,
    sheet_h: float,
) -> list[tuple[float, float, float, float]]:
    free_list: list[tuple[float, float, float, float]] = [(0.0, 0.0, sheet_w, sheet_h)]
    for p in placed_m + placed_stock:
        free_list = _subtract_obstacle(free_list, (p["x"], p["y"], p["w"], p["h"]))
    return free_list


def _waste_score(free_list: list[tuple[float, float, float, float]]) -> float:
    """Higher is better: favor one large rectangular waste area over many small slivers."""
    if not free_list:
        return 0.0
    areas = [w * h for _x, _y, w, h in free_list]
    max_a = max(areas)
    count = len(areas)
    return max_a * 1000.0 - count * 50.0


def _pick_stock_dims(
    w: float, h: float, vw: float, vh: float, prefer_horizontal: bool
) -> tuple[float, float] | None:
    opts: list[tuple[float, float]] = []
    if w <= vw and h <= vh:
        opts.append((w, h))
    if h <= vw and w <= vh:
        opts.append((h, w))
    if not opts:
        return None
    if prefer_horizontal:
        return max(opts, key=lambda t: (t[0], t[1]))  # wider first, then taller
    return max(opts, key=lambda t: t[0] * t[1])


def _pack_single_void(
    fx: float,
    fy: float,
    fw: float,
    fh: float,
    fitting: list[dict[str, Any]],
    *,
    algo: type,
    allow_rotation: bool,
    prefer_horizontal: bool,
    sort_by_area_desc: bool,
    to_i,
    from_i,
) -> list[dict[str, Any]]:
    wi, hi = to_i(fw), to_i(fh)
    if wi < 1 or hi < 1:
        return []

    items = list(fitting)
    if sort_by_area_desc:
        items.sort(key=lambda s: s["w"] * s["h"], reverse=True)
    elif prefer_horizontal:
        items.sort(key=lambda s: max(s["w"], s["h"]), reverse=True)

    packer = newPacker(PackingMode.Offline, PackingBin.BBF, algo, sort_algo=SORT_NONE, rotation=allow_rotation)
    packer.add_bin(wi, hi)
    pool_rids: dict[int, dict[str, Any]] = {}
    for s in items:
        pool_rids[s["rid"]] = s
        if allow_rotation and not prefer_horizontal:
            packer.add_rect(to_i(s["w"]), to_i(s["h"]), rid=s["rid"])
        else:
            dims = _pick_stock_dims(s["w"], s["h"], fw, fh, prefer_horizontal)
            if dims is None:
                continue
            packer.add_rect(to_i(dims[0]), to_i(dims[1]), rid=s["rid"])

    packer.pack()
    out: list[dict[str, Any]] = []
    for rect in packer.rect_list():
        _b, x, y, w, h, rid_i = rect
        rid_i = int(rid_i)
        if rid_i not in pool_rids:
            continue
        meta = pool_rids[rid_i]
        out.append(
            {
                "x": fx + from_i(x),
                "y": fy + from_i(y),
                "w": from_i(w),
                "h": from_i(h),
                "rid": f"S-{rid_i}",
                "kind": "stock",
                "label": meta["label"],
                "variant_id": meta["variant_id"],
                "_rid_i": rid_i,
            }
        )
    return out


def _validate_stock_placements(
    candidates: list[dict[str, Any]],
    fx: float,
    fy: float,
    fw: float,
    fh: float,
    placed_m: list[dict[str, Any]],
    placed_stock: list[dict[str, Any]],
    sheet_w: float,
    sheet_h: float,
) -> list[dict[str, Any]]:
    valid: list[dict[str, Any]] = []
    for p in candidates:
        px, py, pw, ph = p["x"], p["y"], p["w"], p["h"]
        if px < -0.5 or py < -0.5 or px + pw > sheet_w + 0.5 or py + ph > sheet_h + 0.5:
            continue
        if px + pw > fx + fw + 0.5 or py + ph > fy + fh + 0.5:
            continue
        if any(_rects_overlap(px, py, pw, ph, m["x"], m["y"], m["w"], m["h"]) for m in placed_m):
            continue
        if any(_rects_overlap(px, py, pw, ph, s["x"], s["y"], s["w"], s["h"]) for s in placed_stock):
            continue
        if any(_rects_overlap(px, py, pw, ph, v["x"], v["y"], v["w"], v["h"]) for v in valid):
            continue
        valid.append(p)
    return valid


def _pack_stock_in_voids(
    placed_m: list[dict[str, Any]],
    stock_options: list[PieceIn],
    sheet_w: float,
    sheet_h: float,
    to_i,
    from_i,
    stock_rid_base: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Pack stock per void; pick layout that keeps the largest waste rectangle (less fragmentation)."""
    free_list = _free_rects_from_placed(placed_m, [], sheet_w, sheet_h)

    voids = sorted(
        [(fx, fy, fw, fh) for fx, fy, fw, fh in free_list if fw >= 1 and fh >= 1],
        key=lambda r: r[2] * r[3],
        reverse=True,
    )

    stock_pool: list[dict[str, Any]] = []
    rid_s = stock_rid_base
    for s in stock_options:
        cap = min(s.quantity, 500)
        for _ in range(cap):
            stock_pool.append(
                {
                    "rid": rid_s,
                    "w": s.width,
                    "h": s.height,
                    "label": s.label or f"Stock {s.width}×{s.height} mm",
                    "variant_id": s.variant_id,
                }
            )
            rid_s += 1

    placed_stock: list[dict[str, Any]] = []
    used_rids: set[int] = set()

    void_strategies: list[tuple[type, bool, bool, bool]] = [
        (MaxRectsBl, False, True, True),   # horizontal rows, Bottom-Left → large top waste
        (MaxRectsBlsf, False, True, True),
        (MaxRectsBl, False, True, False),
        (MaxRectsBlsf, True, False, True),  # legacy rotate-any
        (MaxRectsBssf, False, True, True),
    ]

    for fx, fy, fw, fh in voids:
        if not stock_pool:
            break

        fitting = [s for s in stock_pool if s["rid"] not in used_rids and _piece_fits_void(s["w"], s["h"], fw, fh)]
        if not fitting:
            continue

        best_valid: list[dict[str, Any]] = []
        best_score = -1.0

        for algo, allow_rot, prefer_horiz, sort_area in void_strategies:
            raw = _pack_single_void(
                fx,
                fy,
                fw,
                fh,
                fitting,
                algo=algo,
                allow_rotation=allow_rot,
                prefer_horizontal=prefer_horiz,
                sort_by_area_desc=sort_area,
                to_i=to_i,
                from_i=from_i,
            )
            valid = _validate_stock_placements(raw, fx, fy, fw, fh, placed_m, placed_stock, sheet_w, sheet_h)
            if not valid:
                continue
            trial_free = _free_rects_from_placed(placed_m, placed_stock + valid, sheet_w, sheet_h)
            score = _waste_score(trial_free) + len(valid) * 5.0
            if score > best_score:
                best_score = score
                best_valid = valid

        for p in best_valid:
            rid_i = p.pop("_rid_i", None)
            if rid_i is not None:
                used_rids.add(int(rid_i))
            placed_stock.append(p)

    unplaced_stock: list[dict[str, Any]] = []
    for s in stock_pool:
        if s["rid"] not in used_rids:
            unplaced_stock.append(
                {
                    "rid": f"S-{s['rid']}",
                    "kind": "stock",
                    "label": s["label"],
                    "width": s["w"],
                    "height": s["h"],
                }
            )

    return placed_stock, unplaced_stock


def _build_dxf(sheet_w: float, sheet_h: float, rects: list[tuple[float, float, float, float]]) -> str:
    doc = ezdxf.new("R2000")
    msp = doc.modelspace()
    msp.add_lwpolyline(
        [(0, 0), (sheet_w, 0), (sheet_w, sheet_h), (0, sheet_h)],
        close=True,
    )
    for x, y, w, h in rects:
        msp.add_lwpolyline([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], close=True)
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue()


def _build_plt(rects: list[tuple[float, float, float, float]]) -> str:
    units_per_mm = 40

    def u(mm: float) -> int:
        return int(round(mm * units_per_mm))

    parts: list[str] = ["IN;", "SP1;"]
    for x, y, w, h in rects:
        x1, y1 = u(x), u(y)
        x2, y2 = u(x + w), u(y + h)
        parts.append(f"PU{x1},{y1};")
        parts.append(f"PD{x2},{y1},{x2},{y2},{x1},{y2},{x1},{y1};")
        parts.append("PU;")
    parts.append("SP0;")
    return "".join(parts)


# Heuristics that often find better layouts for “puzzle” mandatory sets (e.g. 4×vertical + 1×horizontal).
_MANDATORY_PACK_ALGOS = (MaxRectsBlsf, MaxRectsBaf, MaxRectsBssf, MaxRectsBl)


def _pack_mandatory_best(
    sheet_w: float,
    sheet_h: float,
    mandatory: list[PieceIn],
    scale: int,
    to_i,
) -> tuple[list[tuple[int, int, int, int, int, int]], dict[int, dict[str, Any]], int]:
    """
    Returns (rect_list as from packer, rect_meta, total_mandatory_instances).
    rect_list entries: (bin_id, x, y, w, h, rid)
    """
    sw_i, sh_i = to_i(sheet_w), to_i(sheet_h)
    total_inst = sum(p.quantity for p in mandatory)

    best_list: list[tuple[int, int, int, int, int, int]] | None = None
    best_meta: dict[int, dict[str, Any]] | None = None
    for Algo in _MANDATORY_PACK_ALGOS:
        packer = newPacker(PackingMode.Offline, PackingBin.BBF, Algo, sort_algo=SORT_NONE, rotation=True)
        packer.add_bin(sw_i, sh_i)
        rect_meta: dict[int, dict[str, Any]] = {}
        rid = 0
        for p in mandatory:
            for _ in range(p.quantity):
                rect_meta[rid] = {
                    "kind": "mandatory",
                    "label": p.label or f"{p.width}×{p.height} mm",
                    "variant_id": p.variant_id,
                    "w": p.width,
                    "h": p.height,
                }
                packer.add_rect(to_i(p.width), to_i(p.height), rid=rid)
                rid += 1
        packer.pack()
        lst = list(packer.rect_list())
        if best_list is None or len(lst) > len(best_list):
            best_list = lst
            best_meta = rect_meta
        if len(lst) >= total_inst:
            break

    assert best_list is not None and best_meta is not None
    return best_list, best_meta, total_inst


def _run_pack(data: NestingRequest) -> dict[str, Any]:
    scale = 100

    def to_i(v: float) -> int:
        return max(1, int(round(v * scale)))

    def from_i(v: int) -> float:
        return v / scale

    sheet_w, sheet_h = data.sheet_width, data.sheet_height
    sheet_area = sheet_w * sheet_h

    mand_list, rect_meta_m, total_mand = _pack_mandatory_best(sheet_w, sheet_h, data.mandatory, scale, to_i)

    placed_m: list[dict[str, Any]] = []
    placed_m_rids: set[int] = set()
    for rect in mand_list:
        _b, x, y, w, h, rid_i = rect
        rid_i = int(rid_i)
        placed_m_rids.add(rid_i)
        meta = rect_meta_m.get(rid_i, {})
        placed_m.append(
            {
                "x": from_i(x),
                "y": from_i(y),
                "w": from_i(w),
                "h": from_i(h),
                "rid": f"M-{rid_i}",
                "kind": "mandatory",
                "label": meta.get("label", str(rid_i)),
                "variant_id": meta.get("variant_id"),
            }
        )

    all_mand_rids = list(rect_meta_m.keys())
    unplaced_m: list[dict[str, Any]] = []
    for rid_i in all_mand_rids:
        if rid_i not in placed_m_rids:
            m = rect_meta_m[rid_i]
            unplaced_m.append(
                {
                    "rid": f"M-{rid_i}",
                    "kind": "mandatory",
                    "label": m["label"],
                    "width": m["w"],
                    "height": m["h"],
                }
            )

    all_mandatory_placed = len(placed_m) >= total_mand and len(unplaced_m) == 0

    placed: list[dict[str, Any]] = list(placed_m)
    unplaced: list[dict[str, Any]] = list(unplaced_m)
    stock_rid_base = 10_000

    if all_mandatory_placed and data.stock_options:
        placed_s, _unplaced_s = _pack_stock_in_voids(
            placed_m, data.stock_options, sheet_w, sheet_h, to_i, from_i, stock_rid_base
        )
        placed.extend(placed_s)

    placed_area = sum(p["w"] * p["h"] for p in placed)
    efficiency = (placed_area / sheet_area * 100.0) if sheet_area > 0 else 0.0
    waste_area = max(0.0, sheet_area - placed_area)
    waste_percent = (waste_area / sheet_area * 100.0) if sheet_area > 0 else 0.0

    void_free = [(0.0, 0.0, sheet_w, sheet_h)]
    for p in placed:
        void_free = _subtract_obstacle(void_free, (p["x"], p["y"], p["w"], p["h"]))
    void_free.sort(key=lambda r: r[2] * r[3], reverse=True)
    void_regions = [
        {"x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(h, 2), "area_mm2": round(w * h, 2)}
        for x, y, w, h in void_free[:25]
    ]

    dxf_rects = [(p["x"], p["y"], p["w"], p["h"]) for p in placed]
    dxf_str = _build_dxf(sheet_w, sheet_h, dxf_rects)
    dxf_b64 = base64.b64encode(dxf_str.encode("utf-8")).decode("ascii")
    plt_str = _build_plt(dxf_rects)
    plt_b64 = base64.b64encode(plt_str.encode("utf-8")).decode("ascii")

    return {
        "layout": placed,
        "unplaced": unplaced,
        "efficiency": round(efficiency, 2),
        "waste_area_mm2": round(waste_area, 2),
        "waste_percent": round(waste_percent, 2),
        "void_regions": void_regions,
        "all_mandatory_placed": all_mandatory_placed,
        "dxf_base64": dxf_b64,
        "plt_base64": plt_b64,
        "sheet": {"width": sheet_w, "height": sheet_h},
    }


@app.post("/nest")
async def nest(data: NestingRequest, _: None = Depends(_verify_token)) -> dict[str, Any]:
    return _run_pack(data)


@app.post("/generate-dxf")
async def generate_dxf(data: NestingRequest, _: None = Depends(_verify_token)) -> Response:
    result = _run_pack(data)
    raw = base64.b64decode(result["dxf_base64"])
    return Response(
        content=raw,
        media_type="application/dxf",
        headers={"Content-Disposition": "attachment; filename=corte_guerra_laser.dxf"},
    )


@app.post("/generate-plt")
async def generate_plt(data: NestingRequest, _: None = Depends(_verify_token)) -> Response:
    result = _run_pack(data)
    raw = base64.b64decode(result["plt_base64"])
    return Response(
        content=raw,
        media_type="application/plt",
        headers={"Content-Disposition": "attachment; filename=corte_guerra_laser.plt"},
    )


@app.post("/trace")
async def trace_image(
    _: None = Depends(_verify_token),
    file: UploadFile = File(...),
    target_width_mm: float = Form(...),
    target_height_mm: float = Form(...),
    threshold: int = Form(127),
    invert: str = Form("false"),
    min_area_mm2: float = Form(0.5),
    simplify_epsilon_mm: float = Form(0.05),
    output: str = Form("both"),
    use_external_only: str = Form("true"),
    preview_only: str = Form("false"),
    use_adaptive_threshold: str = Form("false"),
    adaptive_block_size: int = Form(21),
    adaptive_c: int = Form(5),
) -> dict[str, Any]:
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido: {file.content_type}",
        )
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Imagen demasiado grande (máx {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
        )
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Archivo vacío")

    common = dict(
        target_width_mm=target_width_mm,
        target_height_mm=target_height_mm,
        threshold=threshold,
        invert=parse_bool(invert, False),
        min_area_mm2=min_area_mm2,
        simplify_epsilon_mm=simplify_epsilon_mm,
        use_external_only=parse_bool(use_external_only, True),
        use_adaptive_threshold=parse_bool(use_adaptive_threshold, False),
        adaptive_block_size=adaptive_block_size,
        adaptive_c=adaptive_c,
    )

    if parse_bool(preview_only, False):
        return run_preview(data, **common)

    return run_trace(data, output=output, include_preview=True, **common)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
