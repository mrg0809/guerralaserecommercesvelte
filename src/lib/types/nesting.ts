export type LayoutPiece = {
	x: number;
	y: number;
	w: number;
	h: number;
	rid: string;
	kind: 'mandatory' | 'stock';
	label?: string | null;
	variant_id?: string | null;
};

export type UnplacedPiece = {
	rid: string;
	kind: string;
	label: string;
	width: number;
	height: number;
};

export type NestApiResult = {
	success: boolean;
	layout?: LayoutPiece[];
	unplaced?: UnplacedPiece[];
	efficiency?: number;
	dxf_base64?: string;
	plt_base64?: string;
	sheet?: { width: number; height: number };
	error?: string;
};
