import { Capacitor } from '@capacitor/core';

export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;
	try {
		const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
		const map = {
			light: ImpactStyle.Light,
			medium: ImpactStyle.Medium,
			heavy: ImpactStyle.Heavy
		} as const;
		await Haptics.impact({ style: map[style] });
	} catch {
		// sin plugin o dispositivo sin vibración
	}
}

export async function hapticSelection(): Promise<void> {
	await hapticImpact('light');
}

function bindTapHaptics(): void {
	document.addEventListener(
		'click',
		(event) => {
			const target = event.target as HTMLElement | null;
			if (
				!target?.closest(
					'button, a[href], [role="button"], .assistant-chip, .assistant-btn, .assistant-session-item'
				)
			) {
				return;
			}
			void hapticImpact('light');
		},
		{ passive: true }
	);
}

function bindKeyboardInsets(): void {
	import('@capacitor/keyboard')
		.then(({ Keyboard }) => {
			void Keyboard.addListener('keyboardWillShow', (info) => {
				document.documentElement.style.setProperty(
					'--keyboard-offset',
					`${info.keyboardHeight}px`
				);
				document.documentElement.classList.add('keyboard-open');
			});
			void Keyboard.addListener('keyboardWillHide', () => {
				document.documentElement.style.setProperty('--keyboard-offset', '0px');
				document.documentElement.classList.remove('keyboard-open');
			});
		})
		.catch(() => {
			// web / sin plugin
		});
}

export async function initNativeAssistantApp(): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;

	document.documentElement.classList.add('capacitor-native', 'assistant-native-app');

	try {
		const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
		await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
		await Keyboard.setScroll({ isDisabled: false });
		bindKeyboardInsets();
	} catch {
		// noop
	}

	try {
		const { StatusBar, Style } = await import('@capacitor/status-bar');
		await StatusBar.setStyle({ style: Style.Dark });
		await StatusBar.setBackgroundColor({ color: '#131314' });
	} catch {
		// noop
	}

	try {
		const { SplashScreen } = await import('@capacitor/splash-screen');
		await SplashScreen.hide();
	} catch {
		// noop
	}

	bindTapHaptics();
}
