/**
 * API Endpoint: Check Envia.com Configuration
 * GET /api/config/envia-status
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const token = process.env.VITE_ENVIA_API_TOKEN;
	
	return json({
		configured: !!token && token.length > 0,
		tokenLength: token ? token.length : 0,
		tokenPreview: token ? `${token.substring(0, 8)}...${token.substring(token.length - 8)}` : 'NOT SET'
	});
};
