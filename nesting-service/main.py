"""
Nesting service: rectpack + ezdxf DXF export.
Auth: header X-Nesting-Token must match env NESTING_TOKEN.
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
from rectpack import SORT_NONE, newPacker

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
    """
    Build a simple HPGL/PLT using 40 units per mm (0.025mm step).
    RDWorks can import this format directly.
    """
    units_per_mm = 40

    def u(mm: float) -> int:
        return int(round(mm * units_per_mm))

    parts: list[str] = ["IN;", "SP1;"]
    for x, y, w, h in rects:
        x1, y1 = u(x), u(y)
        x2, y2 = u(x + w), u(y + h)
        # Move pen up to first corner, then draw closed rectangle.
        parts.append(f"PU{x1},{y1};")
        parts.append(f"PD{x2},{y1},{x2},{y2},{x1},{y2},{x1},{y1};")
        parts.append("PU;")
    parts.append("SP0;")
    return "".join(parts)


def _run_pack(data: NestingRequest) -> dict[str, Any]:
    """Pack with scaled integers for rectpack; coordinates in mm as floats."""
    scale = 100

    def to_i(v: float) -> int:
        return max(1, int(round(v * scale)))

    def from_i(v: int) -> float:
        return v / scale

    sw_i = to_i(data.sheet_width)
    sh_i = to_i(data.sheet_height)
    # SORT_NONE preserves insertion order so mandatory pieces are attempted first.
    packer = newPacker(rotation=True, sort_algo=SORT_NONE)
    packer.add_bin(sw_i, sh_i)

    rect_meta: dict[int, dict[str, Any]] = {}
    added_rids: list[int] = []
    rid = 0

    for p in data.mandatory:
        for _ in range(p.quantity):
            rect_meta[rid] = {
                "kind": "mandatory",
                "label": p.label or f"{p.width}×{p.height} mm",
                "variant_id": p.variant_id,
                "w": p.width,
                "h": p.height,
            }
            packer.add_rect(to_i(p.width), to_i(p.height), rid=rid)
            added_rids.append(rid)
            rid += 1

    for s in data.stock_options:
        cap = min(s.quantity, 500)
        for _ in range(cap):
            rect_meta[rid] = {
                "kind": "stock",
                "label": s.label or f"Stock {s.width}×{s.height} mm",
                "variant_id": s.variant_id,
                "w": s.width,
                "h": s.height,
            }
            packer.add_rect(to_i(s.width), to_i(s.height), rid=rid)
            added_rids.append(rid)
            rid += 1

    packer.pack()

    placed: list[dict[str, Any]] = []
    placed_rids: set[int] = set()

    for rect in packer.rect_list():
        _b, x, y, w, h, rid_i = rect
        rid_i = int(rid_i)
        placed_rids.add(rid_i)
        meta = rect_meta.get(rid_i, {})
        kind = meta.get("kind", "stock")
        placed.append(
            {
                "x": from_i(x),
                "y": from_i(y),
                "w": from_i(w),
                "h": from_i(h),
                "rid": f"{kind[0].upper()}-{rid_i}",
                "kind": kind,
                "label": meta.get("label", str(rid_i)),
                "variant_id": meta.get("variant_id"),
            }
        )

    sheet_area = data.sheet_width * data.sheet_height
    placed_area = sum(p["w"] * p["h"] for p in placed)
    efficiency = (placed_area / sheet_area * 100.0) if sheet_area > 0 else 0.0

    unplaced: list[dict[str, Any]] = []
    for rid_i in added_rids:
        if rid_i not in placed_rids:
            m = rect_meta[rid_i]
            unplaced.append(
                {
                    "rid": f"{m['kind'][0].upper()}-{rid_i}",
                    "kind": m["kind"],
                    "label": m["label"],
                    "width": m["w"],
                    "height": m["h"],
                }
            )

    dxf_rects = [(p["x"], p["y"], p["w"], p["h"]) for p in placed]
    dxf_str = _build_dxf(data.sheet_width, data.sheet_height, dxf_rects)
    dxf_b64 = base64.b64encode(dxf_str.encode("utf-8")).decode("ascii")
    plt_str = _build_plt(dxf_rects)
    plt_b64 = base64.b64encode(plt_str.encode("utf-8")).decode("ascii")

    return {
        "layout": placed,
        "unplaced": unplaced,
        "efficiency": round(efficiency, 2),
        "dxf_base64": dxf_b64,
        "plt_base64": plt_b64,
        "sheet": {"width": data.sheet_width, "height": data.sheet_height},
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
