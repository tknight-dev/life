import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusInputDataSettings, masks, xyWidthBits } from './workers/calc/calc.model';
import { MouseAction, MouseEngine, MousePosition } from './engines/mouse.engine';
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
	protected static elementEdit: HTMLElement;
	protected static mode: boolean | null = null;
	protected static settingsCalc: CalcBusInputDataSettings;
	protected static settingsCalcIPSMax: number = 1024;
	protected static settingsFPSShow: boolean;
	protected static settingsSeedRandom: boolean;
	protected static settingsVideo: VideoBusInputDataSettings;
	protected static pxCellSize: number;

	private static handler(down: boolean, move: boolean, position: MousePosition | TouchPosition): void {
		if (Edit.mode === null) {
			return;
		}

		const buffer = Edit.buffer,
			domRect: DOMRect = Edit.domRect,
			elementEditStyle: CSSStyleDeclaration = Edit.elementEdit.style,
			pxCellSize: number = Edit.pxCellSize;

		let out: boolean = false,
			px: number = position.x,
			py: number = position.y,
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
				elementEditStyle.display = 'none';

				if (Edit.editActive) {
					Edit.editActive = false;
				}
			} else {
				elementEditStyle.display = 'block';

				elementEditStyle.left = px + 'px';
				elementEditStyle.top = py + 'px';

				if (Edit.editActive) {
					buffer.add((tx << xyWidthBits) | ty | (Edit.mode ? xyValueAlive : xyValueDead));
				}
			}
		} else if (!out) {
			Edit.editActive = down;

			if (down) {
				buffer.add((tx << xyWidthBits) | ty | (Edit.mode ? xyValueAlive : xyValueDead));

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
			if (action.down === true) {
				Edit.handler(true, false, action.position);
			} else if (action.down === false) {
				Edit.handler(false, false, action.position);
			} else {
				Edit.handler(false, true, action.position);
			}
		});
		TouchEngine.setCallback((action: TouchAction) => {
			if (action.cmd === TouchCmd.CLICK) {
				if (action.down === true) {
					Edit.handler(true, false, action.positions[0]);
				} else if (action.down === false) {
					Edit.handler(false, false, action.positions[0]);
				}
			} else if (action.cmd === TouchCmd.CLICK_MOVE) {
				Edit.handler(false, true, action.positions[0]);
			}
		});
	}
}
