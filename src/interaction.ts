import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusInputDataSettings, masks, scalePx, xyWidthBits } from './workers/calc/calc.model';
import { DoubleLinkedList } from './models/double-linked-list.model';
import { MouseAction, MouseCmd, MouseEngine, MousePosition } from './engines/mouse.engine';
import { TouchAction, TouchCmd, TouchEngine, TouchPosition } from './engines/touch.engine';
import { Orientation, OrientationEngine } from './engines/orientation.engine';
import { ResizeEngine } from './engines/resize.engine';
import { VideoBusEngine } from './workers/video/video.bus';
import { VideoBusInputDataSettings, VideoBusOutputDataCamera } from './workers/video/video.model';

/**
 * @author tknight-dev
 */
const { xyValueAlive, xyValueDead } = masks;

interface InteractionEntry {
	down: boolean | undefined;
	move: boolean;
	position: MousePosition | TouchPosition;
	position2: MousePosition | TouchPosition;
	touch: boolean;
	zoom: boolean;
}

export enum InteractionMode {
	DRAW_LIFE,
	DRAW_DEATH,
	ERASE,
	MOVE_ZOOM,
}

export class Interaction {
	protected static bufferInteraction: DoubleLinkedList<InteractionEntry> = new DoubleLinkedList<InteractionEntry>();
	protected static cameraViewportHeightC: number = 0;
	protected static cameraViewportStartXC: number = 0;
	protected static cameraViewportStartYC: number = 0;
	protected static cameraViewportWidthC: number = 0;
	protected static cameraZoom: number = 1;
	protected static domRect: DOMRect;
	protected static editActive: boolean;
	protected static editInterval: ReturnType<typeof setInterval>;
	protected static elementCanvas: HTMLCanvasElement;
	protected static elementCanvasInteractive: HTMLElement;
	protected static elementControlsBackward: HTMLElement;
	protected static elementControlsBackwardFunc: () => void;
	protected static elementControlsForward: HTMLElement;
	protected static elementControlsForwardFunc: () => void;
	protected static elementControlsPause: HTMLElement;
	protected static elementControlsPauseFunc: () => void;
	protected static elementControlsPlay: HTMLElement;
	protected static elementControlsPlayFunc: () => void;
	protected static elementControlsReset: HTMLElement;
	protected static elementControlsResetFunc: () => void;
	protected static elementEdit: HTMLElement;
	protected static elementSpinner: HTMLElement;
	protected static elementRotator: HTMLElement;
	protected static fullscreenClickFunc: () => void;
	protected static gameover: boolean;
	protected static interactionRequest: number;
	protected static mode: InteractionMode = InteractionMode.MOVE_ZOOM;
	protected static mobile: boolean;
	protected static moved: boolean;
	protected static rotateAvailable: boolean;
	protected static rotated: boolean;
	protected static settingsCalc: CalcBusInputDataSettings;
	protected static readonly settingsCalcIPSMax: number = 1024;
	protected static settingsFPSShow: boolean;
	protected static settingsSeedRandom: boolean;
	protected static settingsStatsShowAliveDead: boolean;
	protected static settingsStatsShowPerformance: boolean;
	protected static settingsVideo: VideoBusInputDataSettings;
	protected static spinnerTimeout: ReturnType<typeof setTimeout>;
	protected static swipeLength: number;
	protected static swipeLengthAccepted: number = 200;
	protected static swipePositionPrevious: number;
	protected static pxCellSize: number;
	protected static readonly touchDoubleWindow: number = 300;
	protected static touchUpTimestamp: number = 0;
	protected static touchDownClickTimeout: ReturnType<typeof setTimeout>;

	protected static initializeInteraction(): void {
		// Config
		Interaction.elementEdit = <HTMLElement>document.getElementById('edit');
		Interaction.mobile = Interaction.isMobileOrTablet();

		// Engines
		OrientationEngine.setCallback((orientation: Orientation) => {
			Interaction.rotator(orientation);
		});
		MouseEngine.setCallback((action: MouseAction) => {
			if (action.cmd === MouseCmd.WHEEL) {
				Interaction.bufferInteraction.pushStart({
					down: action.down,
					move: false,
					position: action.position,
					position2: action.position,
					touch: false,
					zoom: true,
				});
			} else if (action.cmd === MouseCmd.MOVE) {
				Interaction.bufferInteraction.pushStart({
					down: undefined,
					move: true,
					position: action.position,
					position2: action.position,
					touch: false,
					zoom: false,
				});
			} else {
				Interaction.bufferInteraction.pushStart({
					down: action.down,
					move: false,
					position: action.position,
					position2: action.position,
					touch: false,
					zoom: false,
				});
			}
		});
		TouchEngine.setCallback((action: TouchAction) => {
			if (action.cmd === TouchCmd.CLICK) {
				console.log('TOUCH CLICK');
				Interaction.bufferInteraction.pushStart({
					down: action.down,
					move: false,
					position: action.positions[0],
					position2: action.positions[0],
					touch: true,
					zoom: false,
				});
			} else if (action.cmd === TouchCmd.CLICK_MOVE) {
				Interaction.bufferInteraction.pushStart({
					down: true,
					move: true,
					position: action.positions[0],
					position2: action.positions[0],
					touch: true,
					zoom: false,
				});
			}

			if (action.cmd === TouchCmd.ZOOM) {
				Interaction.bufferInteraction.pushStart({
					down: action.down,
					move: false,
					position: action.positions[0],
					position2: action.positions[1],
					touch: true,
					zoom: true,
				});
			} else if (action.cmd === TouchCmd.ZOOM_MOVE) {
				Interaction.bufferInteraction.pushStart({
					down: undefined,
					move: true,
					position: action.positions[0],
					position2: action.positions[1],
					touch: true,
					zoom: true,
				});
			}
		});
		ResizeEngine.initialize();
		ResizeEngine.setCallback(() => {
			Interaction.rotator();
			setTimeout(() => {
				Interaction.pxSizeCalc();
			}, 100);
		});
		VideoBusEngine.setCallbackCamera((data: VideoBusOutputDataCamera) => {
			Interaction.cameraViewportHeightC = data.heightC;
			Interaction.cameraViewportStartXC = data.startXC;
			Interaction.cameraViewportStartYC = data.startYC;
			Interaction.cameraViewportWidthC = data.widthC;
		});
		Interaction.pxSizeCalc();

		// Done
		Interaction.processorBinder();
		Interaction.interactionRequest = requestAnimationFrame(Interaction.processor);
		Interaction.rotator(OrientationEngine.getOrientation());
		setTimeout(() => {
			Interaction.pxSizeCalc();
		}, 100);
	}

	private static processor(_: number): void {}

	private static processorBinder(): void {
		let buffer: Set<number> = new Set(),
			cameraMove: boolean = false,
			cameraRelX: number = 0,
			cameraRelY: number = 0,
			cameraViewportHeightC: number = 0,
			cameraViewportStartXC: number = 0,
			cameraViewportStartYC: number = 0,
			cameraViewportWidthC: number = 0,
			cameraUpdated: boolean = false,
			cameraZoom: number = 1,
			cameraZoomMax: number = 100,
			cameraZoomMin: number = 1,
			cameraZoomPrevious: number,
			cameraZoomStep: number = 5,
			domRect: DOMRect,
			pxCellSize: number,
			down: boolean,
			downMode: boolean,
			elementEditStyle: CSSStyleDeclaration = Interaction.elementEdit.style,
			entry: InteractionEntry | undefined,
			mode: InteractionMode = InteractionMode.MOVE_ZOOM,
			move: boolean,
			relX1: number,
			relX2: number,
			relY1: number,
			relY2: number,
			touch: boolean,
			touchDistance: number,
			touchDistancePrevious: number = -1,
			// touchDistanceRelX: number,
			// touchDistanceRelY: number,
			value: number,
			x1: number,
			y1: number,
			zoom: boolean;

		// Limit how often a camera update can be sent via the bus
		setInterval(() => {
			if (cameraUpdated) {
				cameraUpdated = false;

				if (Interaction.cameraZoom !== cameraZoom) {
					Interaction.cameraZoom = cameraZoom;
					Interaction.pxSizeCalc();
				}

				VideoBusEngine.outputCamera({
					move: cameraMove,
					relX: cameraRelX,
					relY: cameraRelY,
					zoom: cameraZoom,
				});
			}
		}, 16); // 16 ~= 16.6 (60FPS)

		/**
		 * Buffer and processing ensures inputs are serially processed
		 */
		let processor = (timestampNow: number) => {
			// Start the request for the next frame
			Interaction.interactionRequest = requestAnimationFrame(processor);
			timestampNow |= 0;

			while (true) {
				entry = Interaction.bufferInteraction.popEnd();

				if (!entry) {
					break;
				}

				cameraViewportHeightC = Interaction.cameraViewportHeightC;
				cameraViewportStartXC = Interaction.cameraViewportStartXC;
				cameraViewportStartYC = Interaction.cameraViewportStartYC;
				cameraViewportWidthC = Interaction.cameraViewportWidthC;
				domRect = Interaction.domRect;
				pxCellSize = Interaction.pxCellSize;
				mode = Interaction.mode;
				move = entry.move;
				relX1 = Interaction.rotated ? entry.position.yRel : entry.position.xRel;
				relX2 = Interaction.rotated ? entry.position2.yRel : entry.position2.xRel;
				relY1 = Interaction.rotated ? 1 - entry.position.xRel : entry.position.yRel;
				relY2 = Interaction.rotated ? 1 - entry.position2.xRel : entry.position2.yRel;
				touch = entry.touch;
				x1 = Interaction.rotated ? entry.position.y : entry.position.x;
				y1 = Interaction.rotated ? domRect.width - entry.position.x : entry.position.y;
				zoom = entry.zoom;

				// Set down state only when defined
				if (entry.down !== undefined) {
					down = entry.down;
				}

				touch && console.log('entry', entry);

				if (relX1 === 0 || relY1 === 0 || relX1 > 0.99 || relY1 > 0.99) {
					down = false;
					move = false;
				}

				// Operate mode
				if (mode === InteractionMode.MOVE_ZOOM) {
					// Modify "camera"
					if (zoom) {
						// Zoom
						if (touch) {
							// Touch
							if (down) {
								if (touchDistancePrevious !== -1) {
									touchDistance = <number>(<TouchPosition>entry.position).distance - touchDistancePrevious;
									if (Math.abs(touchDistance) > 20) {
										cameraZoomPrevious = cameraZoom;
										cameraZoom = Math.max(
											cameraZoomMin,
											Math.min(cameraZoomMax, cameraZoom + (touchDistance > 0 ? cameraZoomStep : -cameraZoomStep)),
										);

										if (cameraZoom !== cameraZoomPrevious) {
											// cameraRelX = touchDistanceRelX;
											// cameraRelY = touchDistanceRelY;
											cameraUpdated = true;
										}

										touchDistancePrevious = <number>(<TouchPosition>entry.position).distance;
									}
								} else {
									touchDistancePrevious = <number>(<TouchPosition>entry.position).distance;
									// touchDistanceRelX = (relX1 + relX2) / 2;
									// touchDistanceRelY = (relY1 + relY2) / 2;
								}
							} else {
								touchDistancePrevious = -1;
							}
						} else {
							// Mouse
							cameraZoomPrevious = cameraZoom;
							cameraZoom = Math.max(
								cameraZoomMin,
								Math.min(cameraZoomMax, cameraZoom + (down ? -cameraZoomStep : cameraZoomStep)),
							);

							down = false;
							if (cameraZoom !== cameraZoomPrevious) {
								// cameraRelX = relX1;
								// cameraRelY = relY1;
								cameraUpdated = true;
							}
						}
					} else {
						if (!move) {
							!cameraMove && !down && Interaction.fullscreenClickFunc();

							cameraMove = false;
							downMode = down;
						}

						// Move
						if (move) {
							if (downMode && cameraRelX !== relX1 && cameraRelY !== relY1) {
								cameraMove = true;
								cameraRelX = 1 - relX1;
								cameraRelY = 1 - relY1;
								cameraUpdated = true;
							}
						} else {
							VideoBusEngine.outputCamera({
								move: false,
								relX: 1 - relX1,
								relY: 1 - relY1,
								zoom: cameraZoom,
							});
						}
					}
				} else if (!zoom) {
					switch (mode) {
						case InteractionMode.DRAW_DEATH:
							value = xyValueDead;
							break;
						case InteractionMode.DRAW_LIFE:
							value = xyValueAlive;
							break;
						case InteractionMode.ERASE:
						default:
							value = 0;
							break;
					}

					if (move) {
						if (touch) {
							elementEditStyle.display = 'none';
						} else {
							elementEditStyle.display = 'block';
							elementEditStyle.left = x1 - ((x1 + (cameraViewportStartXC % 1) * pxCellSize) % pxCellSize) + 'px';
							elementEditStyle.top = y1 - ((y1 + (cameraViewportStartYC % 1) * pxCellSize) % pxCellSize) + 'px';
						}

						if (Interaction.editActive) {
							buffer.add(
								(((cameraViewportStartXC + cameraViewportWidthC * relX1) | 0) << xyWidthBits) |
									((cameraViewportStartYC + cameraViewportHeightC * relY1) | 0) |
									value,
							);
						}
					} else {
						Interaction.fullscreenClickFunc();

						Interaction.editActive = down;

						if (down) {
							buffer.add(
								(((cameraViewportStartXC + cameraViewportWidthC * relX1) | 0) << xyWidthBits) |
									((cameraViewportStartYC + cameraViewportHeightC * relY1) | 0) |
									value,
							);

							clearInterval(Interaction.editInterval);
							Interaction.editInterval = setInterval(() => {
								if (buffer.size) {
									CalcBusEngine.outputLife(Uint32Array.from(buffer));
									buffer.clear();
								}
							}, 40);
						} else {
							clearInterval(Interaction.editInterval);
							if (buffer.size) {
								CalcBusEngine.outputLife(Uint32Array.from(buffer));
								buffer.clear();
							}
						}
					}
				}
			}
		};
		Interaction.processor = processor;
	}

	protected static pxSizeCalc(): void {
		const domRect: DOMRect = Interaction.elementCanvas.getBoundingClientRect();

		let pxCellSize: number;
		if (Interaction.rotated) {
			pxCellSize = Math.round((domRect.height / Interaction.settingsVideo.tableSizeX) * 1000) / 1000;
		} else {
			pxCellSize = Math.round((domRect.width / Interaction.settingsVideo.tableSizeX) * 1000) / 1000;
		}

		if (Interaction.cameraZoom !== 1) {
			pxCellSize *= scalePx(Interaction.cameraZoom, Interaction.settingsVideo.tableSizeX);
		}

		Interaction.domRect = domRect;
		Interaction.elementEdit.style.height = pxCellSize + 'px';
		Interaction.elementEdit.style.width = pxCellSize + 'px';
		Interaction.pxCellSize = pxCellSize;
	}

	protected static rotator(orientation?: Orientation): void {
		if (Interaction.rotateAvailable) {
			let rotate: boolean = Interaction.elementCanvasInteractive.clientWidth < Interaction.elementCanvasInteractive.clientHeight;

			if (Interaction.rotated !== rotate) {
				Interaction.rotated = rotate;

				// VideoBusEngine.outputRotate(rotate);
				rotate ? Interaction.elementRotator.classList.add('rotate') : Interaction.elementRotator.classList.remove('rotate');
			}
		} else {
			if (Interaction.rotated) {
				Interaction.rotated = false;

				// VideoBusEngine.outputRotate(false);
				Interaction.elementRotator.classList.remove('rotate');
			}
		}

		VideoBusEngine.resized();
	}

	protected static spinner(enable: boolean) {
		if (enable) {
			clearTimeout(Interaction.spinnerTimeout);

			Interaction.spinnerTimeout = setTimeout(() => {
				if (Interaction.elementSpinner.style.display !== 'flex') {
					Interaction.elementSpinner.classList.remove('show');
					Interaction.elementSpinner.style.display = 'flex';

					setTimeout(() => {
						Interaction.elementSpinner.classList.add('show');
					}, 10);
				} else {
					Interaction.elementSpinner.classList.add('show');
				}
			}, 100);
		} else {
			clearTimeout(Interaction.spinnerTimeout);

			Interaction.elementSpinner.classList.remove('show');

			Interaction.spinnerTimeout = setTimeout(() => {
				Interaction.elementSpinner.style.display = 'none';
			}, 1000);
		}
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
