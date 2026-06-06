"""Tests for SVG → DXF vector export module."""

from __future__ import annotations

import io
import shutil
import unittest

import ezdxf

from vector.inkscape import svg_to_dxf
from vector.postprocess import LAYER_NAME, normalize_dxf


SAMPLE_SVG = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="86mm" height="54mm" viewBox="0 0 86 54">
  <rect x="5" y="5" width="76" height="44" fill="none" stroke="#000" stroke-width="0.5"/>
  <text x="10" y="30" font-family="Liberation Sans" font-size="8" fill="#000">Guerra Láser</text>
</svg>"""


class TestPostprocess(unittest.TestCase):
    def test_normalize_sets_layer_and_color(self) -> None:
        doc = ezdxf.new("R2010")
        msp = doc.modelspace()
        msp.add_line((0, 0), (10, 10), dxfattribs={"layer": "0", "color": 7})
        buf = io.StringIO()
        doc.write(buf)
        result = normalize_dxf(buf.getvalue().encode('utf-8'))
        out = ezdxf.read(io.StringIO(result.decode('utf-8')))
        for entity in out.modelspace():
            self.assertEqual(entity.dxf.layer, LAYER_NAME)
            self.assertEqual(entity.dxf.color, 0)

    def test_rect_outline_becomes_hatch(self) -> None:
        doc = ezdxf.new("R2010")
        msp = doc.modelspace()
        msp.add_lwpolyline(
            [(1, 1), (3, 1), (3, 3), (1, 3)],
            close=True,
            dxfattribs={"layer": "0", "color": 7},
        )
        buf = io.StringIO()
        doc.write(buf)
        result = normalize_dxf(buf.getvalue().encode('utf-8'))
        out = ezdxf.read(io.StringIO(result.decode('utf-8')))
        types = [e.dxftype() for e in out.modelspace()]
        self.assertIn("HATCH", types)
        self.assertNotIn("LWPOLYLINE", types)


@unittest.skipUnless(shutil.which("inkscape"), "Inkscape not installed")
class TestInkscapePipeline(unittest.TestCase):
    def test_svg_to_dxf_produces_valid_dxf(self) -> None:
        dxf_bytes = svg_to_dxf(SAMPLE_SVG, width_mm=86, height_mm=54)
        self.assertGreater(len(dxf_bytes), 100)
        doc = ezdxf.read(io.StringIO(dxf_bytes.decode('utf-8')))
        entities = list(doc.modelspace())
        self.assertGreater(len(entities), 0)
        for entity in entities:
            self.assertEqual(entity.dxf.layer, LAYER_NAME)
            self.assertEqual(entity.dxf.color, 0)


if __name__ == "__main__":
    unittest.main()
