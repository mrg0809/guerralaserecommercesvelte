"""Tests for nesting DXF/PLT line deduplication and stock/mandatory packing."""

from main import NestingRequest, PieceIn, _build_dxf, _run_pack, _unique_cut_edges

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
    with_sheet = _unique_cut_edges(rects, sheet=(0.0, 0.0, 200.0, 200.0))
    # 7 aristas de piezas + 4 de lámina (segmentos del borde de lámina no coinciden exactos con piezas)
    assert len(with_sheet) == 11


def test_dxf_sheet_outline_optional() -> None:
    rects = [(0.0, 0.0, 100.0, 100.0)]
    edges_pieces = _unique_cut_edges(rects)
    edges_with_sheet = _unique_cut_edges(rects, sheet=(0.0, 0.0, 300.0, 300.0))
    assert len(edges_pieces) == 4
    assert len(edges_with_sheet) > len(edges_pieces)
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
    test_dxf_sheet_outline_optional()
    test_two_1165x920_prefers_large_stock()
    print("ok")
