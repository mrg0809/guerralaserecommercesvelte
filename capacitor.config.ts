import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.guerralaser.asistente',
	appName: 'Guerra Láser Asistente',
	webDir: '.vercel/output/static',
	server: {
		url: 'https://guerralaser.com/mobile/asistente',
		cleartext: false
	},
	plugins: {
		Keyboard: {
			resize: 'body',
			resizeOnFullScreen: true
		},
		SplashScreen: {
			launchAutoHide: true,
			backgroundColor: '#131314',
			showSpinner: false
		},
		StatusBar: {
			style: 'DARK',
			backgroundColor: '#131314'
		}
	}
};

export default config;
