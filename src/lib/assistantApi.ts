import { supabase } from '$lib/supabaseClient';
import { env as publicEnv } from '$env/dynamic/public';
import { shouldUseMobileTokenAuth } from '$lib/mobile/appShell';

const TEAM_MEMBER_KEY = 'gl_ai_team_member_id';

export function getStoredTeamMemberId(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(TEAM_MEMBER_KEY);
}

export function setStoredTeamMemberId(id: string) {
	localStorage.setItem(TEAM_MEMBER_KEY, id);
}

export async function getAiAuthHeaders(): Promise<Record<string, string>> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };

	const mobileToken = publicEnv.PUBLIC_MOBILE_APP_TOKEN;
	if (mobileToken && shouldUseMobileTokenAuth()) {
		headers['X-App-Token'] = mobileToken;
		const memberId = getStoredTeamMemberId();
		if (memberId) headers['X-Team-Member-Id'] = memberId;
		return headers;
	}

	const {
		data: { session }
	} = await supabase.auth.getSession();
	if (session?.access_token) {
		headers['Authorization'] = `Bearer ${session.access_token}`;
	}
	return headers;
}

export async function aiFetch(path: string, options: RequestInit = {}) {
	const authHeaders = await getAiAuthHeaders();
	const headers = { ...authHeaders, ...(options.headers as Record<string, string>) };
	if (options.body instanceof FormData) {
		delete headers['Content-Type'];
	}
	return fetch(path, { ...options, headers });
}

export function isMobileAppMode(): boolean {
	return shouldUseMobileTokenAuth();
}
