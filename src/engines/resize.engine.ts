/**
 * Callback triggered on window resize and shifts to a new monitor (with a new)
 *
 * @author tknight-dev
 */

export class ResizeEngine {
	private static callback: () => void;
	private static dimensionHeight: number;
	private static dimensionWidth: number;
	private static initialized: boolean;
	private static timeout: ReturnType<typeof setTimeout>;
	private static timestamp: number = performance.now();

	public static initialize(): void {
		ResizeEngine.dimensionHeight = window.innerHeight;
		ResizeEngine.dimensionWidth = window.innerWidth;

		addEventListener('resize', (event: any) => {
			if (ResizeEngine.callback) {
				let timestamp = performance.now();

				if (timestamp - ResizeEngine.timestamp > 30) {
					ResizeEngine.dimensionHeight = window.innerHeight;
					ResizeEngine.dimensionWidth = window.innerWidth;
					ResizeEngine.callback();
					ResizeEngine.timestamp = timestamp;
				} else {
					ResizeEngine.dimensionHeight = window.innerHeight;
					ResizeEngine.dimensionWidth = window.innerWidth;
					clearTimeout(ResizeEngine.timeout);
					ResizeEngine.timeout = setTimeout(() => {
						ResizeEngine.callback();
					}, 60);
				}
			}
		});

		setInterval(() => {
			if (ResizeEngine.dimensionHeight !== window.innerHeight || ResizeEngine.dimensionWidth !== window.innerWidth) {
				ResizeEngine.dimensionHeight = window.innerHeight;
				ResizeEngine.dimensionWidth = window.innerWidth;
			}
		}, 1000);
	}

	public static setCallback(callback: () => void): void {
		ResizeEngine.callback = callback;
	}
}
