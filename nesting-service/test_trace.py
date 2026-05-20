"""Pruebas locales del pipeline trace (ejecutar: python test_trace.py desde nesting-service)."""

from __future__ import annotations

import base64
import sys

import cv2
import numpy as np

from trace import _build_trace_dxf, _build_trace_plt, run_preview, run_trace


def _png_bytes(gray: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", gray)
    assert ok
    return bytes(buf)


def test_circle_external() -> None:
    img = np.zeros((200, 200), dtype=np.uint8)
    cv2.circle(img, (100, 100), 60, 255, -1)
    r = run_trace(
        _png_bytes(img),
        target_width_mm=90,
        target_height_mm=50,
        threshold=127,
        invert=False,
        min_area_mm2=0.5,
        simplify_epsilon_mm=0.3,
        output="both",
        use_external_only=True,
    )
    assert r["contour_count"] >= 1
    assert r.get("preview_mask_base64") and r.get("preview_paths_base64")
    dxf = base64.b64decode(r["dxf_base64"]).decode()
    assert "LWPOLYLINE" in dxf
    plt = base64.b64decode(r["plt_base64"]).decode()
    assert plt.startswith("IN;") and "SP1;" in plt and plt.endswith("SP0;")


def test_invert_dark_logo() -> None:
    img = np.full((100, 100), 255, dtype=np.uint8)
    cv2.rectangle(img, (30, 30), (70, 70), 0, -1)
    r = run_trace(
        _png_bytes(img),
        target_width_mm=50,
        target_height_mm=50,
        threshold=200,
        invert=True,
        min_area_mm2=0.1,
        simplify_epsilon_mm=0.2,
        output="both",
        use_external_only=True,
    )
    assert r["contour_count"] >= 1


def test_plt_polyline_coords() -> None:
    polylines = [[(0.0, 0.0), (10.0, 0.0), (10.0, -10.0), (0.0, -10.0), (0.0, 0.0)]]
    plt = _build_trace_plt(polylines)
    assert "PU0,0;" in plt
    assert "PD400,0,400,-400,0,-400,0,0;" in plt


def test_preview_only() -> None:
    img = np.zeros((200, 200), dtype=np.uint8)
    cv2.circle(img, (100, 100), 60, 255, -1)
    r = run_preview(
        _png_bytes(img),
        target_width_mm=90,
        target_height_mm=50,
        threshold=127,
        invert=False,
        min_area_mm2=0.5,
        simplify_epsilon_mm=0.3,
        use_external_only=True,
    )
    assert r["preview_only"] is True
    assert "dxf_base64" not in r
    assert r["preview_mask_base64"]
    assert r["contours_raw"] >= 1


def test_dxf_work_area_rect() -> None:
    dxf = _build_trace_dxf([], 90, 50)
    assert "90" in dxf and "LWPOLYLINE" in dxf


def main() -> None:
    test_circle_external()
    test_invert_dark_logo()
    test_plt_polyline_coords()
    test_preview_only()
    test_dxf_work_area_rect()
    print("All tests passed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        sys.exit(1)
