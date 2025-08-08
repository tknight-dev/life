/**
 * @author tknight-dev
 */

export interface TouchAction {
	cmd: TouchCmd;
	down: boolean;
	elementId: string | undefined;
	positions: TouchPosition[];
}

export enum TouchCmd {
	CLICK,
	CLICK_MOVE,
	ZOOM,
	ZOOM_MOVE,
}

export interface TouchPosition {
	distance?: number;
	distanceRel?: number;
	x: number; // 0 is left of canvas (precision 0)
	xRel: number; // between 0 and 1 (precision 3)
	y: number; // 0 is top of canvas (precision 0)
	yRel: number; // between 0 and 1 (precision 3)
}

export class TouchEngine {
	private static cmdActive: TouchCmd;
	private static cmdActiveStatus: boolean;
	private static callback: (action: TouchAction) => void;
	private static feedFitted: HTMLElement;
	private static positionsLast: TouchPosition[];
	private static suspend: boolean;
	private static timeout: ReturnType<typeof setTimeout>;
	private static timestamp: number = performance.now();

	private static calc(event: TouchEvent): TouchPosition[] {
		let domRect: DOMRect = TouchEngine.feedFitted.getBoundingClientRect(),
			touch: Touch,
			touchList: TouchList = event.touches,
			touchPositions: TouchPosition[] = [],
			x: number,
			y: number;

		for (let i = 0; i < touchList.length; i++) {
			touch = touchList[i];
			let xEff: number = Math.round(Math.max(domRect.x, Math.min(domRect.right, touch.clientX)) - domRect.x);
			let yEff: number = Math.round(Math.max(domRect.y, Math.min(domRect.bottom, touch.clientY)) - domRect.y);

			touchPositions.push({
				x: Math.round(xEff),
				xRel: Math.round((xEff / domRect.width) * 1000) / 1000,
				y: Math.round(yEff),
				yRel: Math.round((yEff / domRect.height) * 1000) / 1000,
			});
		}

		if (touchPositions.length > 1) {
			for (let i = 0; i < touchPositions.length - 1; i++) {
				x = touchPositions[i].xRel - touchPositions[i + 1].xRel;
				y = touchPositions[i].yRel - touchPositions[i + 1].yRel;
				touchPositions[i].distanceRel = Math.round(Math.sqrt(x * x + y * y) * 1000) / 1000;

				x = touchPositions[i].x - touchPositions[i + 1].x;
				y = touchPositions[i].y - touchPositions[i + 1].y;
				touchPositions[i].distance = Math.round(Math.sqrt(x * x + y * y) * 1000) / 1000;
			}
		}

		return touchPositions;
	}

	public static async initialize(feedFitted: HTMLElement, restrictTo?: HTMLElement): Promise<void> {
		TouchEngine.feedFitted = feedFitted;

		((restrictTo || document) as HTMLElement).addEventListener('touchcancel', (event: TouchEvent) => {
			event.preventDefault();

			if (!TouchEngine.suspend && TouchEngine.callback && TouchEngine.cmdActiveStatus) {
				TouchEngine.cmdActiveStatus = false;
				TouchEngine.positionsLast = TouchEngine.calc(event);
				TouchEngine.callback({
					cmd: TouchEngine.cmdActive,
					down: false,
					elementId: (<HTMLElement>event.target).id,
					positions: TouchEngine.positionsLast,
				});
			}
		});

		((restrictTo || document) as HTMLElement).addEventListener('touchend', (event: TouchEvent) => {
			event.preventDefault();

			if (!TouchEngine.suspend && TouchEngine.callback && TouchEngine.cmdActiveStatus) {
				TouchEngine.cmdActiveStatus = false;
				TouchEngine.callback({
					cmd: TouchEngine.cmdActive,
					down: false,
					elementId: (<HTMLElement>event.target).id,
					positions: TouchEngine.positionsLast,
				});
			}
		});

		((restrictTo || document) as HTMLElement).addEventListener('touchmove', (event: TouchEvent) => {
			event.preventDefault();

			if (!TouchEngine.suspend && TouchEngine.callback && TouchEngine.cmdActiveStatus) {
				let timestamp = performance.now();

				if (timestamp - TouchEngine.timestamp > 20) {
					TouchEngine.positionsLast = TouchEngine.calc(event);
					TouchEngine.callback({
						cmd: TouchEngine.cmdActive === TouchCmd.CLICK ? TouchCmd.CLICK_MOVE : TouchCmd.ZOOM_MOVE,
						down: true,
						elementId: (<HTMLElement>event.target).id,
						positions: TouchEngine.positionsLast,
					});
					TouchEngine.timestamp = timestamp;
				} else {
					clearTimeout(TouchEngine.timeout);
					TouchEngine.positionsLast = TouchEngine.calc(event);
					TouchEngine.timeout = setTimeout(() => {
						TouchEngine.callback({
							cmd: TouchEngine.cmdActive,
							down: true,
							elementId: (<HTMLElement>event.target).id,
							positions: TouchEngine.positionsLast,
						});
					}, 20);
				}
			}
		});

		((restrictTo || document) as HTMLElement).addEventListener('touchstart', (event: TouchEvent) => {
			event.preventDefault();

			if (!TouchEngine.suspend && TouchEngine.callback && !TouchEngine.cmdActiveStatus) {
				clearTimeout(TouchEngine.timeout);
				TouchEngine.timeout = setTimeout(() => {
					TouchEngine.cmdActive = event.touches.length === 1 ? TouchCmd.CLICK : TouchCmd.ZOOM;
					TouchEngine.cmdActiveStatus = true;

					TouchEngine.positionsLast = TouchEngine.calc(event);
					TouchEngine.callback({
						cmd: TouchEngine.cmdActive,
						down: true,
						elementId: (<HTMLElement>event.target).id,
						positions: TouchEngine.positionsLast,
					});
				}, 20);
			}
		});
	}

	public static setCallback(callback: (action: TouchAction) => void) {
		TouchEngine.callback = callback;
	}

	public static setSuspend(suspend: boolean) {
		TouchEngine.suspend = suspend;
	}
}
