import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.guerralaser.asistente',
	appName: 'Guerra Láser Asistente',
	webDir: '.vercel/output/static',
	server: {
		url: 'https://guerralaser.com/mobile/asistente',
		cleartext: false
	}
};

export default config;
