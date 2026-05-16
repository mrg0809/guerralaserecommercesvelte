"""
Nesting service: rectpack + ezdxf DXF export + HPGL PLT (RDWorks).
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
from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from rectpack import SORT_NONE, PackingBin, PackingMode, newPacker
from rectpack.maxrects import MaxRectsBaf, MaxRectsBl, MaxRectsBlsf, MaxRectsBssf

app = FastAPI(title="Guerra Láser Nesting", version="1.0.0")

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
        free_list: list[tuple[float, float, float, float]] = [(0.0, 0.0, sheet_w, sheet_h)]
        for p in placed_m:
            free_list = _subtract_obstacle(free_list, (p["x"], p["y"], p["w"], p["h"]))

        bins_meta: list[tuple[float, float, float, float]] = []
        for fx, fy, fw, fh in free_list:
            if fw < 1 or fh < 1:
                continue
            wi, hi = to_i(fw), to_i(fh)
            if wi < 1 or hi < 1:
                continue
            bins_meta.append((fx, fy, fw, fh))

        if bins_meta:
            packer2 = newPacker(PackingMode.Offline, PackingBin.BBF, MaxRectsBlsf, sort_algo=SORT_NONE, rotation=True)
            for fx, fy, fw, fh in bins_meta:
                packer2.add_bin(to_i(fw), to_i(fh))

            rect_meta_s: dict[int, dict[str, Any]] = {}
            rid_s = stock_rid_base
            for s in data.stock_options:
                cap = min(s.quantity, 500)
                for _ in range(cap):
                    rect_meta_s[rid_s] = {
                        "kind": "stock",
                        "label": s.label or f"Stock {s.width}×{s.height} mm",
                        "variant_id": s.variant_id,
                        "w": s.width,
                        "h": s.height,
                    }
                    packer2.add_rect(to_i(s.width), to_i(s.height), rid=rid_s)
                    rid_s += 1

            packer2.pack()
            placed_s_rids: set[int] = set()
            for rect in packer2.rect_list():
                b, x, y, w, h, rid_i = rect
                b = int(b)
                rid_i = int(rid_i)
                if b < 0 or b >= len(bins_meta):
                    continue
                off_x, off_y, _, _ = bins_meta[b]
                placed_s_rids.add(rid_i)
                meta = rect_meta_s.get(rid_i, {})
                placed.append(
                    {
                        "x": off_x + from_i(x),
                        "y": off_y + from_i(y),
                        "w": from_i(w),
                        "h": from_i(h),
                        "rid": f"S-{rid_i}",
                        "kind": "stock",
                        "label": meta.get("label", str(rid_i)),
                        "variant_id": meta.get("variant_id"),
                    }
                )

            for rid_i in rect_meta_s:
                if rid_i not in placed_s_rids:
                    m = rect_meta_s[rid_i]
                    unplaced.append(
                        {
                            "rid": f"S-{rid_i}",
                            "kind": "stock",
                            "label": m["label"],
                            "width": m["w"],
                            "height": m["h"],
                        }
                    )

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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
