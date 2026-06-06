"""Normalize Inkscape DXF output to a single black ENGRAVE layer for LightBurn."""

from __future__ import annotations

import io
import math

import ezdxf
from ezdxf import recover

LAYER_NAME = "ENGRAVE"
BLACK_COLOR = 0
_AXIS_TOL = 1e-3


def _read_dxf(raw: bytes):
    text = raw.decode('utf-8', errors='replace')
    stream = io.StringIO(text)
    try:
        doc, _auditor = recover.read(stream)
        return doc
    except Exception:
        stream = io.StringIO(text)
        return ezdxf.read(stream)


def _polyline_vertices(entity) -> list[tuple[float, float]] | None:
    dxftype = entity.dxftype()
    if dxftype == 'LWPOLYLINE':
        return [(float(p[0]), float(p[1])) for p in entity.get_points('xy')]
    if dxftype == 'POLYLINE' and entity.is_closed:
        return [(float(v.dxf.location.x), float(v.dxf.location.y)) for v in entity.vertices]
    return None


def _is_closed(vertices: list[tuple[float, float]]) -> bool:
    if len(vertices) < 3:
        return False
    x0, y0 = vertices[0]
    x1, y1 = vertices[-1]
    return math.isclose(x0, x1, abs_tol=_AXIS_TOL) and math.isclose(y0, y1, abs_tol=_AXIS_TOL)


def _normalize_ring(vertices: list[tuple[float, float]]) -> list[tuple[float, float]]:
    ring = list(vertices)
    if len(ring) > 1 and _is_closed(ring):
        ring = ring[:-1]
    return ring


def _is_axis_aligned_rectangle(vertices: list[tuple[float, float]]) -> bool:
    ring = _normalize_ring(vertices)
    if len(ring) != 4:
        return False

    xs = {round(p[0], 4) for p in ring}
    ys = {round(p[1], 4) for p in ring}
    if len(xs) != 2 or len(ys) != 2:
        return False

    for i in range(4):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % 4]
        if not (math.isclose(x1, x2, abs_tol=_AXIS_TOL) or math.isclose(y1, y2, abs_tol=_AXIS_TOL)):
            return False

    return True


def _filled_rect_outlines_to_hatch(doc) -> None:
    """Convert closed rectangular outlines (Inkscape fill export) to solid HATCH."""
    msp = doc.modelspace()
    to_remove: list = []

    for entity in list(msp):
        if entity.dxftype() not in ('LWPOLYLINE', 'POLYLINE'):
            continue
        if entity.dxftype() == 'LWPOLYLINE' and not entity.closed:
            continue

        vertices = _polyline_vertices(entity)
        if not vertices or not _is_axis_aligned_rectangle(vertices):
            continue

        ring = _normalize_ring(vertices)
        hatch = msp.add_hatch(dxfattribs={'layer': LAYER_NAME, 'color': BLACK_COLOR})
        hatch.set_solid_fill(color=BLACK_COLOR)
        hatch.paths.add_polyline_path(ring, is_closed=True)
        to_remove.append(entity)

    for entity in to_remove:
        msp.delete_entity(entity)


def normalize_dxf(raw: bytes) -> bytes:
    """Single ENGRAVE layer, black color, solid fills for rectangular regions."""
    doc = _read_dxf(raw)

    if LAYER_NAME not in doc.layers:
        doc.layers.add(LAYER_NAME, color=BLACK_COLOR)

    _filled_rect_outlines_to_hatch(doc)

    msp = doc.modelspace()
    for entity in msp:
        entity.dxf.layer = LAYER_NAME
        entity.dxf.color = BLACK_COLOR

    out = io.StringIO()
    doc.write(out)
    return out.getvalue().encode('utf-8')
