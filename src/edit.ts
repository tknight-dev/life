import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusInputDataSettings, masks, xyWidthBits } from './workers/calc/calc.model';
import { MouseAction, MouseCmd, MouseEngine, MousePosition } from './engines/mouse.engine';
import { TouchAction, TouchCmd, TouchEngine, TouchPosition } from './engines/touch.engine';
import { Orientation, OrientationEngine } from './engines/orientation.engine';
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
	protected static elementCanvasInteractive: HTMLElement;
	protected static elementControlsBackward: HTMLElement;
	protected static elementControlsForward: HTMLElement;
	protected static elementEdit: HTMLElement;
	protected static elementRotator: HTMLElement;
	protected static gameover: boolean;
	protected static mode: boolean | null = null;
	protected static mobile: boolean;
	protected static rotateAvailable: boolean;
	protected static rotated: boolean;
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

			if (Edit.rotated) {
				px = position.y / devicePixelRatio;
				py = domRect.width - position.x / devicePixelRatio;

				if (px === 0 || py === 0 || py === domRect.width || px === domRect.height) {
					out = true;
				}
			} else {
				if (px === 0 || py === 0 || px === domRect.width || py === domRect.height) {
					out = true;
				}
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

		let pxCellSize: number;
		if (Edit.rotated) {
			pxCellSize = Math.round((domRect.height / Edit.settingsVideo.tableSizeX) * 1000) / 1000;
		} else {
			pxCellSize = Math.round((domRect.width / Edit.settingsVideo.tableSizeX) * 1000) / 1000;
		}

		Edit.domRect = domRect;
		Edit.elementEdit.style.height = pxCellSize + 'px';
		Edit.elementEdit.style.width = pxCellSize + 'px';
		Edit.pxCellSize = pxCellSize;
	}

	protected static initializeEdit(): void {
		// Config
		Edit.elementEdit = <HTMLElement>document.getElementById('edit');
		Edit.mobile = Edit.isMobileOrTablet();

		// Engines
		OrientationEngine.setCallback((orientation: Orientation) => {
			Edit.rotator(orientation);
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
		ResizeEngine.initialize();
		ResizeEngine.setCallback(() => {
			Edit.rotator();
			setTimeout(() => {
				Edit.pxSizeCalc();
			}, 100);
		});

		// Done
		Edit.rotator(OrientationEngine.getOrientation());
		setTimeout(() => {
			Edit.pxSizeCalc();
		}, 100);
	}

	protected static rotator(orientation?: Orientation): void {
		if (Edit.rotateAvailable) {
			let rotate: boolean = Edit.elementCanvasInteractive.clientWidth < Edit.elementCanvasInteractive.clientHeight;

			if (Edit.rotated !== rotate) {
				Edit.rotated = rotate;

				// VideoBusEngine.outputRotate(rotate);
				rotate ? Edit.elementRotator.classList.add('rotate') : Edit.elementRotator.classList.remove('rotate');
			}
		} else {
			if (Edit.rotated) {
				Edit.rotated = false;

				// VideoBusEngine.outputRotate(false);
				Edit.elementRotator.classList.remove('rotate');
			}
		}

		VideoBusEngine.resized();
	}

	// http://detectmobilebrowsers.com/
	protected static isMobileOrTablet(): boolean {
		let check = false;
		(function (a) {
			if (
				/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(
					a,
				) ||
				/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
					a.substr(0, 4),
				)
			)
				check = true;
		})(navigator.userAgent || navigator.vendor);
		return check;
	}
}
