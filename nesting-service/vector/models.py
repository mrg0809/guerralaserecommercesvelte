from pydantic import BaseModel, Field


class ExportDxfRequest(BaseModel):
    svg: str = Field(..., min_length=10, max_length=2_000_000)
    width_mm: float = Field(gt=0, le=500)
    height_mm: float = Field(gt=0, le=500)
    filename: str = Field(default="diseno_guerra_laser.dxf", max_length=120)
