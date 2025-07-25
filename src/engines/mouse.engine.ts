/**
 * @author tknight-dev
 */

export interface MouseAction {
	cmd: MouseCmd;
	down: boolean | undefined;
	elementId: string | undefined;
	position: MousePosition;
}

export enum MouseCmd {
	LEFT,
	LEFT_CLICK,
	MOVE,
	WHEEL,
}

export interface MousePosition {
	x: number; // 0 is left of canvas (precision 0)
	xRel: number; // between 0 and 1 (precision 3)
	y: number; // 0 is top of canvas (precision 0)
	yRel: number; // between 0 and 1 (precision 3)
}

export class MouseEngine {
	private static callback: (action: MouseAction) => void;
	private static feedFitted: HTMLElement;
	private static suspend: boolean;
	private static timeout: ReturnType<typeof setTimeout>;
	private static timestamp: number = performance.now();

	private static calc(event: MouseEvent): MousePosition {
		let domRect: DOMRect = MouseEngine.feedFitted.getBoundingClientRect(),
			xEff: number = Math.round(Math.max(domRect.x, Math.min(domRect.right, event.clientX)) - domRect.x),
			yEff: number = Math.round(Math.max(domRect.y, Math.min(domRect.bottom, event.clientY)) - domRect.y);

		//console.log('mouse', domRect.width, domRect.x, xEff, Math.round((xEff / domRect.width) * 1000) / 1000);
		xEff *= window.devicePixelRatio;
		yEff *= window.devicePixelRatio;

		return {
			x: Math.round(xEff),
			xRel: Math.round((xEff / domRect.width) * 1000) / 1000,
			y: Math.round(yEff),
			yRel: Math.round((yEff / domRect.height) * 1000) / 1000,
		};
	}

	public static async initialize(feedFitted: HTMLElement): Promise<void> {
		MouseEngine.feedFitted = feedFitted;

		document.addEventListener('click', (event: MouseEvent) => {
			if (MouseEngine.callback && event.button === 0) {
				// 0 is left click
				MouseEngine.callback({
					cmd: MouseCmd.LEFT_CLICK,
					down: undefined,
					elementId: (<HTMLElement>event.target).id,
					position: MouseEngine.calc(event),
				});
			}
		});
		document.addEventListener('mousedown', (event: MouseEvent) => {
			if (MouseEngine.callback && event.button === 0) {
				// 0 is left click
				MouseEngine.callback({
					cmd: MouseCmd.LEFT,
					down: true,
					elementId: (<HTMLElement>event.target).id,
					position: MouseEngine.calc(event),
				});
			}
		});
		document.addEventListener('mousemove', (event: MouseEvent) => {
			if (MouseEngine.callback) {
				let timestamp = performance.now();

				if (timestamp - MouseEngine.timestamp > 20) {
					MouseEngine.callback({
						cmd: MouseCmd.MOVE,
						down: undefined,
						elementId: (<HTMLElement>event.target).id,
						position: MouseEngine.calc(event),
					});
					MouseEngine.timestamp = timestamp;
				} else {
					clearTimeout(MouseEngine.timeout);
					MouseEngine.timeout = setTimeout(() => {
						MouseEngine.callback({
							cmd: MouseCmd.MOVE,
							down: undefined,
							elementId: (<HTMLElement>event.target).id,
							position: MouseEngine.calc(event),
						});
					}, 40);
				}
			}
		});
		document.addEventListener('mouseup', (event: MouseEvent) => {
			if (MouseEngine.callback && event.button === 0) {
				// 0 is left click
				MouseEngine.callback({
					cmd: MouseCmd.LEFT,
					down: false,
					elementId: (<HTMLElement>event.target).id,
					position: MouseEngine.calc(event),
				});
			}
		});
		document.addEventListener('wheel', (event: any) => {
			if (!MouseEngine.suspend && MouseEngine.callback) {
				if (event.deltaY > 0) {
					MouseEngine.callback({
						cmd: MouseCmd.WHEEL,
						down: true,
						elementId: (<HTMLElement>event.target).id,
						position: MouseEngine.calc(event),
					});
				} else {
					MouseEngine.callback({
						cmd: MouseCmd.WHEEL,
						down: false,
						elementId: (<HTMLElement>event.target).id,
						position: MouseEngine.calc(event),
					});
				}
			}
		});
	}

	public static setCallback(callback: (action: MouseAction) => void) {
		MouseEngine.callback = callback;
	}

	public static setSuspend(suspend: boolean) {
		MouseEngine.suspend = suspend;
	}
}
