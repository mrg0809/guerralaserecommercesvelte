"""Tests for nesting DXF/PLT line deduplication and stock/mandatory packing."""

from main import NestingRequest, PieceIn, _build_dxf, _edges_for_export, _run_pack, _unique_cut_edges

STOCK_PRESETS = [
    PieceIn(width=1220, height=1220, quantity=10, label="122x122"),
    PieceIn(width=1200, height=900, quantity=10, label="120x90"),
    PieceIn(width=1200, height=600, quantity=10, label="120x60"),
    PieceIn(width=900, height=600, quantity=10, label="90x60"),
    PieceIn(width=600, height=400, quantity=10, label="60x40"),
    PieceIn(width=400, height=400, quantity=10, label="40x40"),
    PieceIn(width=200, height=300, quantity=10, label="20x30"),
]


def test_unique_edges_merge_shared_side() -> None:
    # Dos cuadrados 100×100 pegados: comparten arista vertical en x=100
    rects = [(0.0, 0.0, 100.0, 100.0), (100.0, 0.0, 100.0, 100.0)]
    edges = _unique_cut_edges(rects)
    assert len(edges) == 7


def test_dxf_uses_line_not_stacked_polylines() -> None:
    rects = [(0.0, 0.0, 100.0, 100.0), (100.0, 0.0, 100.0, 100.0)]
    dxf = _build_dxf(300.0, 300.0, rects)
    assert "LINE" in dxf
    assert dxf.count("LWPOLYLINE") == 0


def test_sheet_outline_added_without_duplicating_touching_pieces() -> None:
    # Dos piezas apiladas comparten un lado horizontal
    rects = [(0.0, 0.0, 100.0, 100.0), (0.0, 100.0, 100.0, 100.0)]
    assert len(_unique_cut_edges(rects)) == 7


def test_omit_edges_on_material_boundary() -> None:
    # Pieza en esquina (0,0): solo deben quedar aristas derecha y la interna (si hay más piezas)
    rects = [(0.0, 0.0, 1165.0, 920.0), (0.0, 920.0, 1165.0, 920.0), (0.0, 1840.0, 1200.0, 600.0)]
    edges = _edges_for_export(rects, 1220.0, 2440.0, include_sheet_outline=False)
    for x1, y1, x2, y2 in edges:
        assert not (abs(x1) < 1 and abs(x2) < 1), "no borde izquierdo del material"
        assert not (abs(y1) < 1 and abs(y2) < 1), "no borde superior del material"
        assert not (abs(y1 - 2440) < 1 and abs(y2 - 2440) < 1), "no borde inferior del material"
    rights = [e for e in edges if abs(e[0] - e[2]) < 1 and e[0] > 100]
    assert len(rights) >= 2


def test_dxf_sheet_outline_optional() -> None:
    rects = [(0.0, 0.0, 100.0, 100.0)]
    inner = _edges_for_export(rects, 300.0, 300.0, include_sheet_outline=False)
    with_outline = _edges_for_export(rects, 300.0, 300.0, include_sheet_outline=True)
    assert len(inner) == 2
    assert len(with_outline) > len(inner)
    assert "LWPOLYLINE" not in _build_dxf(300.0, 300.0, rects, include_sheet_outline=False)


def test_two_1165x920_prefers_large_stock() -> None:
    r = _run_pack(
        NestingRequest(
            sheet_width=1220,
            sheet_height=2440,
            mandatory=[PieceIn(width=1165, height=920, quantity=2)],
            stock_options=STOCK_PRESETS,
        )
    )
    mand = [p for p in r["layout"] if p["kind"] == "mandatory"]
    stk = [p for p in r["layout"] if p["kind"] == "stock"]
    assert len(mand) == 2
    assert all(p["w"] == 1165 and p["h"] == 920 for p in mand)
    assert len(stk) >= 1
    assert max(s["w"] * s["h"] for s in stk) >= 600 * 400


if __name__ == "__main__":
    test_unique_edges_merge_shared_side()
    test_dxf_uses_line_not_stacked_polylines()
    test_sheet_outline_added_without_duplicating_touching_pieces()
    test_omit_edges_on_material_boundary()
    test_dxf_sheet_outline_optional()
    test_two_1165x920_prefers_large_stock()
    print("ok")
