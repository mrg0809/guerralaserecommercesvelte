"""Tests for nesting DXF/PLT line deduplication."""

from main import _build_dxf, _unique_cut_edges


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
    assert len(_unique_cut_edges(rects)) == 6
    with_sheet = _unique_cut_edges(rects, sheet=(0.0, 0.0, 200.0, 200.0))
    # 6 aristas de piezas + 4 de lámina (ninguna coincide exacta con un lado de pieza)
    assert len(with_sheet) == 10


if __name__ == "__main__":
    test_unique_edges_merge_shared_side()
    test_dxf_uses_line_not_stacked_polylines()
    test_sheet_edge_deduped_with_piece_on_border()
    print("ok")
