"""Normalize Inkscape DXF output to a single black ENGRAVE layer for LightBurn."""

from __future__ import annotations

import io

import ezdxf
from ezdxf import recover

LAYER_NAME = "ENGRAVE"
BLACK_COLOR = 0


def _read_dxf(raw: bytes):
    text = raw.decode('utf-8', errors='replace')
    stream = io.StringIO(text)
    try:
        doc, _auditor = recover.read(stream)
        return doc
    except Exception:
        stream = io.StringIO(text)
        return ezdxf.read(stream)


def normalize_dxf(raw: bytes) -> bytes:
    """Move all entities to ENGRAVE layer with ACI color 0 (black)."""
    doc = _read_dxf(raw)

    if LAYER_NAME not in doc.layers:
        doc.layers.add(LAYER_NAME, color=BLACK_COLOR)

    msp = doc.modelspace()
    for entity in msp:
        entity.dxf.layer = LAYER_NAME
        entity.dxf.color = BLACK_COLOR

    out = io.StringIO()
    doc.write(out)
    return out.getvalue().encode('utf-8')
