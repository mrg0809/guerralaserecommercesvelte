import { Capacitor } from '@capacitor/core';

export function isNativeCapacitorApp(): boolean {
	return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

export function isMobileAssistantRoute(pathname: string): boolean {
	return pathname.startsWith('/mobile');
}

/** App Capacitor o ruta /mobile — sin header/footer del ecommerce */
export function isStandaloneAssistantApp(pathname: string): boolean {
	return isMobileAssistantRoute(pathname) || isNativeCapacitorApp();
}

/** Auth móvil: token embebido solo en app /mobile o Capacitor nativo */
export function shouldUseMobileTokenAuth(): boolean {
	if (typeof window === 'undefined') return false;
	return isStandaloneAssistantApp(window.location.pathname);
}
