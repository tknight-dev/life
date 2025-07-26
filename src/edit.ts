import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusInputDataSettings, masks, xyWidthBits } from './workers/calc/calc.model';
import { MouseAction, MouseCmd, MouseEngine, MousePosition } from './engines/mouse.engine';
import { TouchAction, TouchCmd, TouchEngine, TouchPosition } from './engines/touch.engine';
import { ResizeEngine } from './engines/resize.engine';
import { VideoBusEngine } from './workers/video/video.bus';
import { VideoBusInputDataSettings } from './workers/video/video.model';

/**
 * @author tknight-dev
 */
const { xyValueAlive, xyValueDead } = masks;

interface Placement {
	x: number;
	y: number;
}

export class Edit {
	protected static buffer: Set<number> = new Set();
	protected static domRect: DOMRect;
	protected static editActive: boolean;
	protected static editInterval: ReturnType<typeof setInterval>;
	protected static elementCanvas: HTMLCanvasElement;
	protected static elementCanvasInteractive: HTMLCanvasElement;
	protected static elementControlsBackward: HTMLElement;
	protected static elementControlsForward: HTMLElement;
	protected static elementEdit: HTMLElement;
	protected static gameover: boolean;
	protected static mode: boolean | null = null;
	protected static settingsCalc: CalcBusInputDataSettings;
	protected static settingsCalcIPSMax: number = 1024;
	protected static settingsFPSShow: boolean;
	protected static settingsSeedRandom: boolean;
	protected static settingsStatsShowAliveDead: boolean;
	protected static settingsVideo: VideoBusInputDataSettings;
	protected static swipeLength: number;
	protected static swipeLengthAccepted: number = 9;
	protected static swipePositionPrevious: number;
	protected static pxCellSize: number;

	private static handler(down: boolean, move: boolean, position: MousePosition | TouchPosition, touch: boolean): void {
		if (!position) {
			return;
		}

		// Standard edit interaction
		if (Edit.mode !== null) {
			const buffer = Edit.buffer,
				devicePixelRatio: number = Math.round(window.devicePixelRatio * 1000) / 1000,
				domRect: DOMRect = Edit.domRect,
				elementEditStyle: CSSStyleDeclaration = Edit.elementEdit.style,
				pxCellSize: number = Edit.pxCellSize;

			let out: boolean = false,
				px: number = position.x / devicePixelRatio,
				py: number = position.y / devicePixelRatio,
				tx: number,
				ty: number;
			if (px === 0 || py === 0 || px === domRect.width || py === domRect.height) {
				out = true;
			}
			tx = (px / pxCellSize) | 0;
			ty = (py / pxCellSize) | 0;

			px = tx * pxCellSize;
			py = ty * pxCellSize;

			if (move) {
				if (out) {
					Edit.editActive = false;
					elementEditStyle.display = 'none';
				} else {
					if (!touch) {
						elementEditStyle.display = 'block';

						elementEditStyle.left = px + 'px';
						elementEditStyle.top = py + 'px';
					} else {
						elementEditStyle.display = 'none';
					}

					if (Edit.editActive) {
						buffer.add((tx << xyWidthBits) | ty | (Edit.mode ? xyValueAlive : xyValueDead));
					}
				}
			} else if (!out) {
				Edit.editActive = down;

				if (down) {
					if (!touch) {
						buffer.add((tx << xyWidthBits) | ty | (Edit.mode ? xyValueAlive : xyValueDead));
					}

					clearInterval(Edit.editInterval);
					Edit.editInterval = setInterval(() => {
						if (buffer.size) {
							CalcBusEngine.outputLife(Uint32Array.from(buffer));
							buffer.clear();
						}
					}, 40);
				} else {
					clearInterval(Edit.editInterval);
					if (buffer.size) {
						CalcBusEngine.outputLife(Uint32Array.from(buffer));
						buffer.clear();
					}
				}
			}
		} else if (touch) {
			// Swipe for speedup or speeddown
			const domRect: DOMRect = Edit.domRect;

			let out: boolean = false,
				px: number = position.x / devicePixelRatio,
				py: number = position.y / devicePixelRatio;

			if (px === 0 || py === 0 || px === domRect.width || py === domRect.height) {
				out = true;
			}

			if (move) {
				if (out) {
					Edit.editActive = false;
				} else if (Edit.editActive) {
					Edit.swipeLength = px - Edit.swipePositionPrevious;
					Edit.swipePositionPrevious = px;
				}
			} else if (!out) {
				Edit.editActive = down;

				if (down) {
					Edit.swipeLength = 0;
					Edit.swipePositionPrevious = px;

					clearInterval(Edit.editInterval);
					Edit.editInterval = setInterval(() => {
						if (Math.abs(Edit.swipeLength) > Edit.swipeLengthAccepted) {
							if (Edit.swipeLength > 0) {
								Edit.elementControlsForward.click();
							} else {
								Edit.elementControlsBackward.click();
							}

							Edit.swipeLength = 0;
							Edit.swipePositionPrevious = px;
						}
					}, 120);
				} else {
					clearInterval(Edit.editInterval);
					if (Math.abs(Edit.swipeLength) > Edit.swipeLengthAccepted) {
						if (Edit.swipeLength > 0) {
							Edit.elementControlsForward.click();
						} else {
							Edit.elementControlsBackward.click();
						}

						Edit.swipeLength = 0;
						Edit.swipePositionPrevious = px;
					}
				}
			}
		}
	}

	protected static pxSizeCalc(): void {
		const domRect: DOMRect = Edit.elementCanvas.getBoundingClientRect();
		let pxCellSize: number = Math.round((domRect.width / Edit.settingsVideo.tableSizeX) * 1000) / 1000;

		Edit.domRect = domRect;
		Edit.elementEdit.style.height = pxCellSize + 'px';
		Edit.elementEdit.style.width = pxCellSize + 'px';
		Edit.pxCellSize = pxCellSize;
	}

	protected static initializeEdit(): void {
		Edit.elementEdit = <HTMLElement>document.getElementById('edit');

		setTimeout(() => {
			Edit.pxSizeCalc();
		}, 100);

		// Config
		ResizeEngine.initialize();
		ResizeEngine.setCallback(() => {
			VideoBusEngine.resized();

			setTimeout(() => {
				Edit.pxSizeCalc();
			}, 100);
		});

		MouseEngine.setCallback((action: MouseAction) => {
			if (action.cmd === MouseCmd.WHEEL) {
				if (action.down) {
					Edit.elementControlsBackward.click();
				} else {
					Edit.elementControlsForward.click();
				}
			} else {
				if (action.down === true) {
					Edit.handler(true, false, action.position, false);
				} else if (action.down === false) {
					Edit.handler(false, false, action.position, false);
				} else {
					Edit.handler(false, true, action.position, false);
				}
			}
		});
		TouchEngine.setCallback((action: TouchAction) => {
			if (action.cmd === TouchCmd.CLICK) {
				if (action.down === true) {
					Edit.handler(true, false, action.positions[0], true);
				} else if (action.down === false) {
					Edit.handler(false, false, action.positions[0], true);
				}
			} else if (action.cmd === TouchCmd.CLICK_MOVE) {
				Edit.handler(false, true, action.positions[0], true);
			}
		});
	}
}
