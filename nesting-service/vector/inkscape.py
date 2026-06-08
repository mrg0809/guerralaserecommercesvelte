"""Convert SVG string to DXF bytes using Inkscape CLI."""

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from vector.postprocess import normalize_dxf

INKSCAPE_TIMEOUT_S = 60
DXF_EXTENSION = "org.ekips.output.dxf_outlines"


def _find_inkscape() -> str:
    path = shutil.which("inkscape")
    if not path:
        raise RuntimeError("Inkscape no está instalado en el contenedor")
    return path


def _ensure_svg_dimensions(svg: str, width_mm: float, height_mm: float) -> str:
    """Inject width/height in mm if the SVG root lacks physical units."""
    if re.search(r'width\s*=\s*"[\d.]+\s*mm"', svg, re.I):
        return svg
    svg = re.sub(
        r"<svg\b",
        f'<svg width="{width_mm}mm" height="{height_mm}mm"',
        svg,
        count=1,
        flags=re.I,
    )
    if 'viewBox=' not in svg[:500]:
        svg = re.sub(
            r"<svg\b",
            f'<svg viewBox="0 0 {width_mm} {height_mm}"',
            svg,
            count=1,
            flags=re.I,
        )
    return svg


def _run_inkscape(args: list[str]) -> None:
    inkscape = _find_inkscape()
    result = subprocess.run(
        [inkscape, *args],
        capture_output=True,
        text=True,
        timeout=INKSCAPE_TIMEOUT_S,
    )
    if result.returncode != 0:
        stderr = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"Inkscape falló: {stderr[:500]}")


def svg_to_dxf(svg_content: str, width_mm: float, height_mm: float) -> bytes:
    """Full pipeline: SVG → text-to-path → DXF R14 → normalized single layer."""
    svg_content = _ensure_svg_dimensions(svg_content, width_mm, height_mm)

    with tempfile.TemporaryDirectory(prefix="vector_export_") as tmp:
        tmp_path = Path(tmp)
        input_svg = tmp_path / "input.svg"
        paths_svg = tmp_path / "paths.svg"
        output_dxf = tmp_path / "output.dxf"

        input_svg.write_text(svg_content, encoding="utf-8")

        _run_inkscape(
            [
                str(input_svg),
                "--export-type=svg",
                "--export-text-to-path",
                f"--export-filename={paths_svg}",
            ]
        )

        source = paths_svg if paths_svg.exists() and paths_svg.stat().st_size > 0 else input_svg

        _run_inkscape(
            [
                str(source),
                "--export-type=dxf",
                f"--export-extension={DXF_EXTENSION}",
                f"--export-filename={output_dxf}",
            ]
        )

        if not output_dxf.exists() or output_dxf.stat().st_size == 0:
            raise RuntimeError("Inkscape no generó archivo DXF")

        raw = output_dxf.read_bytes()
        return normalize_dxf(raw)
