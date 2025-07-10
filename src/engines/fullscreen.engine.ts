/**
 * @author tknight-dev
 */

export class FullscreenEngine {
	private static callback: (state: boolean) => void;
	private static state: boolean;

	public static initialize(): void {
		addEventListener('fullscreenchange', (event: any) => {
			const state: boolean = document.fullscreenElement !== null;
			if (FullscreenEngine.state !== state) {
				FullscreenEngine.state = state;

				if (FullscreenEngine.callback) {
					FullscreenEngine.callback(state);
				}
			}
		});
	}

	public static async close(): Promise<void> {
		if (!FullscreenEngine.state) {
			return;
		}

		try {
			await document.exitFullscreen();
			FullscreenEngine.state = false;
		} catch (error: any) {}
	}

	public static async open(element: HTMLElement): Promise<boolean> {
		if (FullscreenEngine.state) {
			console.error('FullscreenEngine > open: already open');
			return false;
		}

		await element.requestFullscreen();
		FullscreenEngine.state = true;

		return true;
	}

	public static setCallback(callback: (state: boolean) => void): void {
		FullscreenEngine.callback = callback;
	}

	public static isOpen(): boolean {
		return FullscreenEngine.state;
	}
}
