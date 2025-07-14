/**
 * @author tknight-dev
 */

export class VisibilityEngine {
	private static callback: (state: boolean) => void;
	private static state: boolean;

	public static async initialize(): Promise<void> {
		addEventListener('visibilitychange', (event: any) => {
			const state: boolean = document.visibilityState !== 'hidden';

			if (VisibilityEngine.state !== state) {
				VisibilityEngine.state = state;

				if (VisibilityEngine.callback) {
					setTimeout(() => VisibilityEngine.callback(state), 60);
				}
			}
		});
	}

	public static setCallback(callback: (state: boolean) => void): void {
		VisibilityEngine.callback = callback;
	}

	public static isVisible(): boolean {
		return VisibilityEngine.state;
	}
}
