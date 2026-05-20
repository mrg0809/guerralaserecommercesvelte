export type VectorizeBBox = {
	width: number;
	height: number;
};

export type VectorizeApiResult = {
	success: boolean;
	preview_only?: boolean;
	contour_count?: number;
	contours_raw?: number;
	contours_kept?: number;
	bbox_mm?: VectorizeBBox;
	target_mm?: { width: number; height: number };
	preview_mask_base64?: string;
	preview_paths_base64?: string;
	dxf_base64?: string;
	plt_base64?: string;
	warnings?: string[];
	error?: string;
	detail?: string;
};
