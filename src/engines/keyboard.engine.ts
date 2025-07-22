/**
 * @author tknight-dev
 */

export interface KeyAction {
	down: boolean;
	key: KeyCommon;
}

export enum KeyCommon {
	ESC = 27,
	LEFT = 37,
	RIGHT = 39,
	SPACE_BAR = 32,
}

export interface KeyRegistration {
	callback: (keyAction: KeyAction) => void;
	keyAction: KeyAction;
}

export class KeyboardEngine {
	private static registered: { [key: number]: KeyRegistration } = {}; // key is hash
	private static state: { [key: number]: boolean } = {}; // key is keyCode, !undefined is down
	private static suspend: boolean;

	public static async initialize(): Promise<void> {
		document.addEventListener('keydown', (event: KeyboardEvent) => {
			KeyboardEngine.state[event.keyCode] = true;
		});
		document.addEventListener('keyup', (event: KeyboardEvent) => {
			KeyboardEngine.state[event.keyCode] = false;
		});

		KeyboardEngine.processor();
	}

	public static register(keyCommon: KeyCommon, callback: (keyAction: KeyAction) => void): void {
		if (KeyboardEngine.state[keyCommon] === undefined) {
			KeyboardEngine.state[keyCommon] = false;
		}
		KeyboardEngine.registered[keyCommon] = {
			callback: callback,
			keyAction: {
				down: KeyboardEngine.state[keyCommon],
				key: keyCommon,
			},
		};
	}

	public static unregister(keyCode: number): void {
		delete KeyboardEngine.registered[keyCode];
	}

	/**
	 * Check key usage every X ms
	 */
	private static async processor(): Promise<void> {
		const delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
			registered: { [key: number]: KeyRegistration } = KeyboardEngine.registered,
			state: { [key: number]: boolean } = KeyboardEngine.state;
		let i: string, keyAction: KeyAction, keyRegistration: KeyRegistration, keyState: boolean;

		while (true) {
			await delay(20);

			if (!KeyboardEngine.suspend) {
				for (i in registered) {
					keyRegistration = registered[i];
					keyAction = keyRegistration.keyAction;
					keyState = state[i];

					if (keyAction.down !== keyState) {
						keyAction.down = keyState;
						keyRegistration.callback(keyAction);
					}
				}
			}
		}
	}

	public static setSuspend(suspend: boolean) {
		KeyboardEngine.suspend = suspend;
	}
}
