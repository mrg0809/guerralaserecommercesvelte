export type VectorizeBBox = {
	width: number;
	height: number;
};

export type VectorizeApiResult = {
	success: boolean;
	contour_count?: number;
	bbox_mm?: VectorizeBBox;
	target_mm?: { width: number; height: number };
	dxf_base64?: string;
	plt_base64?: string;
	warnings?: string[];
	error?: string;
	detail?: string;
};
