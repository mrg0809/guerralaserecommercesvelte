"""
Nesting + trace service: rectpack nesting, image→DXF/PLT trace, ezdxf + HPGL (RDWorks).
Auth: header X-Nesting-Token must match env NESTING_TOKEN.

Packing strategy:
1) Place ALL mandatory pieces first; score layouts so voids fit large stock (e.g. 1165×920 horizontal, not rotated strip).
2) Only if every mandatory fits, pack stock largest-first into voids (maximize stock area, not piece count).
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
    include_sheet_outline: bool = Field(
        default=False,
        description="Si true, añade el rectángulo exterior de la lámina al DXF/PLT (borde del material).",
    )


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


def _unique_stock_sizes(stock_options: list[PieceIn]) -> list[tuple[float, float]]:
    seen: set[tuple[float, float]] = set()
    sizes: list[tuple[float, float]] = []
    for s in stock_options:
        for w, h in ((s.width, s.height), (s.height, s.width)):
            key = (round(w, 1), round(h, 1))
            if key in seen:
                continue
            seen.add(key)
            sizes.append((w, h))
    sizes.sort(key=lambda t: t[0] * t[1], reverse=True)
    return sizes


def _max_stock_area_fitting_voids(
    free_list: list[tuple[float, float, float, float]], stock_sizes: list[tuple[float, float]]
) -> float:
    """Área de la pieza de stock más grande que cabría en algún hueco."""
    best = 0.0
    for _fx, _fy, fw, fh in free_list:
        for sw, sh in stock_sizes:
            if _piece_fits_void(sw, sh, fw, fh):
                best = max(best, sw * sh)
    return best


def _mandatory_layout_score(
    placed_m: list[dict[str, Any]],
    rect_meta: dict[int, dict[str, Any]],
    sheet_w: float,
    sheet_h: float,
    stock_options: list[PieceIn],
) -> float:
    """
    Mejor layout = huecos donde caben piezas de stock grandes + desperdicio compacto
    + respetar orientación pedida (ancho×alto) cuando sea posible.
    """
    free = _free_rects_from_placed(placed_m, [], sheet_w, sheet_h)
    stock_sizes = _unique_stock_sizes(stock_options) if stock_options else []
    max_stock = _max_stock_area_fitting_voids(free, stock_sizes)
    orient_bonus = 0.0
    for p in placed_m:
        rid = int(str(p["rid"]).split("-")[-1])
        meta = rect_meta.get(rid, {})
        mw, mh = meta.get("w"), meta.get("h")
        if mw and mh and abs(p["w"] - mw) < 1 and abs(p["h"] - mh) < 1:
            orient_bonus += 1.0
    return max_stock * 1_000_000.0 + _waste_score(free) + orient_bonus * 500.0


def _stock_placement_score(
    valid: list[dict[str, Any]],
    placed_m: list[dict[str, Any]],
    placed_stock: list[dict[str, Any]],
    sheet_w: float,
    sheet_h: float,
) -> float:
    """Prioriza cubrir más área con menos piezas pequeñas."""
    stock_area = sum(p["w"] * p["h"] for p in valid)
    trial_free = _free_rects_from_placed(placed_m, placed_stock + valid, sheet_w, sheet_h)
    return stock_area * 10_000.0 + _waste_score(trial_free) - len(valid) * 2.0


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


def _pack_void_greedy_largest(
    fx: float,
    fy: float,
    fw: float,
    fh: float,
    fitting: list[dict[str, Any]],
    *,
    prefer_horizontal: bool,
    placed_m: list[dict[str, Any]],
    placed_stock: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Coloca piezas de stock de mayor a menor área, una por iteración."""
    items = sorted(fitting, key=lambda s: s["w"] * s["h"], reverse=True)
    used: set[int] = set()
    out: list[dict[str, Any]] = []
    free_void: list[tuple[float, float, float, float]] = [(fx, fy, fw, fh)]

    while True:
        best: dict[str, Any] | None = None
        best_area = 0.0
        for s in items:
            rid_i = int(s["rid"])
            if rid_i in used:
                continue
            for vx, vy, vw, vh in free_void:
                dims = _pick_stock_dims(s["w"], s["h"], vw, vh, prefer_horizontal)
                if dims is None:
                    continue
                dw, dh = dims
                px, py = vx, vy
                if px + dw > fx + fw + 0.5 or py + dh > fy + fh + 0.5:
                    continue
                if any(_rects_overlap(px, py, dw, dh, m["x"], m["y"], m["w"], m["h"]) for m in placed_m):
                    continue
                if any(_rects_overlap(px, py, dw, dh, o["x"], o["y"], o["w"], o["h"]) for o in placed_stock):
                    continue
                if any(_rects_overlap(px, py, dw, dh, o["x"], o["y"], o["w"], o["h"]) for o in out):
                    continue
                area = dw * dh
                if area > best_area:
                    best_area = area
                    best = {
                        "x": px,
                        "y": py,
                        "w": dw,
                        "h": dh,
                        "rid": f"S-{rid_i}",
                        "kind": "stock",
                        "label": s["label"],
                        "variant_id": s["variant_id"],
                        "_rid_i": rid_i,
                    }
        if best is None:
            break
        out.append(best)
        used.add(int(best["_rid_i"]))
        free_void = _subtract_obstacle(free_void, (best["x"], best["y"], best["w"], best["h"]))

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
    # Instancias ordenadas por área descendente (grandes primero)
    stock_entries: list[tuple[float, PieceIn]] = []
    for s in stock_options:
        cap = min(s.quantity, 500)
        area = s.width * s.height
        for _ in range(cap):
            stock_entries.append((area, s))
    stock_entries.sort(key=lambda t: t[0], reverse=True)
    for area, s in stock_entries:
        _ = area
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

        greedy_raw = _pack_void_greedy_largest(
            fx, fy, fw, fh, fitting, prefer_horizontal=True, placed_m=placed_m, placed_stock=placed_stock
        )
        greedy_valid = _validate_stock_placements(
            greedy_raw, fx, fy, fw, fh, placed_m, placed_stock, sheet_w, sheet_h
        )
        if greedy_valid:
            g_score = _stock_placement_score(greedy_valid, placed_m, placed_stock, sheet_w, sheet_h)
            if g_score > best_score:
                best_score = g_score
                best_valid = greedy_valid

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
            score = _stock_placement_score(valid, placed_m, placed_stock, sheet_w, sheet_h)
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


_EDGE_TOL_MM = 0.05


def _quantize_mm(v: float, tol: float = _EDGE_TOL_MM) -> float:
    return round(v / tol) * tol


def _edge_key(x1: float, y1: float, x2: float, y2: float) -> tuple[tuple[float, float], tuple[float, float]]:
    """Clave canónica de arista (sin dirección) para deduplicar líneas compartidas."""
    p1 = (_quantize_mm(x1), _quantize_mm(y1))
    p2 = (_quantize_mm(x2), _quantize_mm(y2))
    return (p1, p2) if p1 <= p2 else (p2, p1)


def _rect_edges(x: float, y: float, w: float, h: float) -> list[tuple[float, float, float, float]]:
    x2, y2 = x + w, y + h
    return [
        (x, y, x2, y),
        (x2, y, x2, y2),
        (x2, y2, x, y2),
        (x, y2, x, y),
    ]


def _unique_cut_edges(
    rects: list[tuple[float, float, float, float]],
) -> list[tuple[float, float, float, float]]:
    """
    Aristas únicas de todos los rectángulos.
    Si dos piezas comparten un lado, solo se devuelve una línea.
    """
    seen: set[tuple[tuple[float, float], tuple[float, float]]] = set()
    unique: list[tuple[float, float, float, float]] = []
    for x, y, w, h in rects:
        for edge in _rect_edges(x, y, w, h):
            key = _edge_key(*edge)
            if key in seen:
                continue
            seen.add(key)
            unique.append(edge)
    return unique


def _edge_on_sheet_boundary(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    sheet_w: float,
    sheet_h: float,
    tol: float = 0.5,
) -> bool:
    """True si el segmento coincide con un borde de la lámina (no hace falta cortar ahí)."""
    if abs(x1 - x2) <= tol:
        if abs(x1) <= tol or abs(x1 - sheet_w) <= tol:
            return True
    if abs(y1 - y2) <= tol:
        if abs(y1) <= tol or abs(y1 - sheet_h) <= tol:
            return True
    return False


def _omit_sheet_boundary_edges(
    edges: list[tuple[float, float, float, float]],
    sheet_w: float,
    sheet_h: float,
) -> list[tuple[float, float, float, float]]:
    return [e for e in edges if not _edge_on_sheet_boundary(*e, sheet_w, sheet_h)]


def _edges_for_export(
    rects: list[tuple[float, float, float, float]],
    sheet_w: float,
    sheet_h: float,
    *,
    include_sheet_outline: bool = False,
) -> list[tuple[float, float, float, float]]:
    """
    Aristas de corte para DXF/PLT: sin líneas en el borde del material salvo que
    se pida explícitamente el contorno completo de la lámina.
    """
    edges = _omit_sheet_boundary_edges(_unique_cut_edges(rects), sheet_w, sheet_h)
    if not include_sheet_outline:
        return edges
    seen = {_edge_key(*e) for e in edges}
    out = list(edges)
    for edge in _rect_edges(0.0, 0.0, sheet_w, sheet_h):
        key = _edge_key(*edge)
        if key not in seen:
            seen.add(key)
            out.append(edge)
    return out


def _build_dxf(
    sheet_w: float,
    sheet_h: float,
    rects: list[tuple[float, float, float, float]],
    *,
    include_sheet_outline: bool = False,
) -> str:
    doc = ezdxf.new("R2000")
    msp = doc.modelspace()
    for x1, y1, x2, y2 in _edges_for_export(rects, sheet_w, sheet_h, include_sheet_outline=include_sheet_outline):
        msp.add_line((x1, y1), (x2, y2))
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue()


def _build_plt(
    rects: list[tuple[float, float, float, float]],
    *,
    sheet_w: float = 0.0,
    sheet_h: float = 0.0,
    include_sheet_outline: bool = False,
) -> str:
    units_per_mm = 40

    def u(mm: float) -> int:
        return int(round(mm * units_per_mm))

    parts: list[str] = ["IN;", "SP1;"]
    for x1, y1, x2, y2 in _edges_for_export(
        rects, sheet_w, sheet_h, include_sheet_outline=include_sheet_outline
    ):
        parts.append(f"PU{u(x1)},{u(y1)};")
        parts.append(f"PD{u(x2)},{u(y2)};")
        parts.append("PU;")
    parts.append("SP0;")
    return "".join(parts)


# Heuristics that often find better layouts for “puzzle” mandatory sets (e.g. 4×vertical + 1×horizontal).
_MANDATORY_PACK_ALGOS = (MaxRectsBlsf, MaxRectsBaf, MaxRectsBssf, MaxRectsBl)


def _rect_list_to_placed_m(
    lst: list[tuple[int, int, int, int, int, int]],
    rect_meta: dict[int, dict[str, Any]],
    from_i,
) -> list[dict[str, Any]]:
    placed: list[dict[str, Any]] = []
    for rect in lst:
        _b, x, y, w, h, rid_i = rect
        rid_i = int(rid_i)
        meta = rect_meta.get(rid_i, {})
        placed.append(
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
    return placed


def _pack_mandatory_best(
    sheet_w: float,
    sheet_h: float,
    mandatory: list[PieceIn],
    stock_options: list[PieceIn],
    scale: int,
    to_i,
    from_i,
) -> tuple[list[tuple[int, int, int, int, int, int]], dict[int, dict[str, Any]], int]:
    """
    Returns (rect_list as from packer, rect_meta, total_mandatory_instances).
    Elige el layout que deja huecos aptos para stock grande (p. ej. 2×1165×920 en horizontal).
    """
    sw_i, sh_i = to_i(sheet_w), to_i(sheet_h)
    total_inst = sum(p.quantity for p in mandatory)

    best_list: list[tuple[int, int, int, int, int, int]] | None = None
    best_meta: dict[int, dict[str, Any]] | None = None
    best_score = -1.0
    best_count = -1

    for Algo in _MANDATORY_PACK_ALGOS:
        for allow_rotation in (True, False):
            packer = newPacker(
                PackingMode.Offline, PackingBin.BBF, Algo, sort_algo=SORT_NONE, rotation=allow_rotation
            )
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
            count = len(lst)
            if count < best_count and best_count >= total_inst:
                continue
            if count < total_inst:
                if count > best_count:
                    best_list = lst
                    best_meta = rect_meta
                    best_count = count
                continue
            placed_m = _rect_list_to_placed_m(lst, rect_meta, from_i)
            score = _mandatory_layout_score(placed_m, rect_meta, sheet_w, sheet_h, stock_options)
            if count > best_count or score > best_score:
                best_list = lst
                best_meta = rect_meta
                best_score = score
                best_count = count

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

    mand_list, rect_meta_m, total_mand = _pack_mandatory_best(
        sheet_w, sheet_h, data.mandatory, data.stock_options, scale, to_i, from_i
    )

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
    outline = data.include_sheet_outline
    dxf_str = _build_dxf(sheet_w, sheet_h, dxf_rects, include_sheet_outline=outline)
    dxf_b64 = base64.b64encode(dxf_str.encode("utf-8")).decode("ascii")
    plt_str = _build_plt(dxf_rects, sheet_w=sheet_w, sheet_h=sheet_h, include_sheet_outline=outline)
    plt_b64 = base64.b64encode(plt_str.encode("utf-8")).decode("ascii")

    return {
        "layout": placed,
        "unplaced": unplaced,
        "efficiency": round(efficiency, 2),
        "waste_area_mm2": round(waste_area, 2),
        "waste_percent": round(waste_percent, 2),
        "void_regions": void_regions,
        "all_mandatory_placed": all_mandatory_placed,
        "include_sheet_outline": outline,
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
