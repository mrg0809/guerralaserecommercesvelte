"""FastAPI router for SVG → DXF export."""

from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from fastapi.responses import FileResponse

from vector.inkscape import svg_to_dxf
from vector.models import ExportDxfRequest

router = APIRouter(prefix="/api/v1/vector", tags=["vector"])


def _verify_token(x_nesting_token: str | None = Header(default=None)) -> None:
    expected = os.getenv("NESTING_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=500, detail="NESTING_TOKEN no configurado en el servidor")
    if not x_nesting_token or x_nesting_token.strip() != expected:
        raise HTTPException(status_code=401, detail="Token inválido")


def _safe_filename(name: str) -> str:
    base = re.sub(r"[^\w.\-]", "_", name.strip()) or "diseno_guerra_laser.dxf"
    if not base.lower().endswith(".dxf"):
        base += ".dxf"
    return base[:120]


@router.post("/export-dxf")
async def export_dxf(
    data: ExportDxfRequest,
    background_tasks: BackgroundTasks,
    _: None = Depends(_verify_token),
) -> FileResponse:
    try:
        dxf_bytes = svg_to_dxf(data.svg, data.width_mm, data.height_mm)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    tmp = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False)
    try:
        tmp.write(dxf_bytes)
        tmp.close()
    except Exception:
        Path(tmp.name).unlink(missing_ok=True)
        raise

    safe_name = _safe_filename(data.filename)
    background_tasks.add_task(lambda p=tmp.name: Path(p).unlink(missing_ok=True))

    return FileResponse(
        path=tmp.name,
        media_type="application/dxf",
        filename=safe_name,
    )
