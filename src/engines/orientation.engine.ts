/**
 * @author tknight-dev
 */

export enum Orientation {
	LANDSCAPE = 0,
	PORTRAIT = 1,
}

export class OrientationEngine {
	private static callback: (orientation: Orientation) => void;
	private static orientation: Orientation;
	private static timeout: ReturnType<typeof setTimeout>;

	public static initialize(): void {
		if (screen.orientation.type.startsWith('portrait')) {
			OrientationEngine.orientation = Orientation.PORTRAIT;
		} else {
			OrientationEngine.orientation = Orientation.LANDSCAPE;
		}

		screen.orientation.addEventListener('change', (event: any) => {
			clearTimeout(OrientationEngine.timeout);
			OrientationEngine.timeout = setTimeout(() => {
				if (screen.orientation.type.startsWith('portrait')) {
					if (OrientationEngine.orientation !== Orientation.PORTRAIT) {
						OrientationEngine.orientation = Orientation.PORTRAIT;
						OrientationEngine.callback && OrientationEngine.callback(Orientation.PORTRAIT);
					}
				} else {
					if (OrientationEngine.orientation !== Orientation.LANDSCAPE) {
						OrientationEngine.orientation = Orientation.LANDSCAPE;
						OrientationEngine.callback && OrientationEngine.callback(Orientation.LANDSCAPE);
					}
				}
			}, 40);
		});
	}

	/**
	 * Not widely supported as of 10/30/24
	 */
	public static async lock(orientation: Orientation): Promise<boolean> {
		try {
			if (orientation === Orientation.PORTRAIT) {
				await (<any>screen.orientation).lock('portrait');
			} else {
				await (<any>screen.orientation).lock('landscape');
			}
		} catch (error: any) {
			return false;
		}
		return true;
	}

	public static unlock(): boolean {
		try {
			window.screen.orientation.unlock();
		} catch (error: any) {
			return false;
		}
		return true;
	}

	public static setCallback(callback: (orientation: Orientation) => void): void {
		OrientationEngine.callback = callback;
	}

	public static getOrientation(): Orientation {
		return OrientationEngine.orientation;
	}
}
