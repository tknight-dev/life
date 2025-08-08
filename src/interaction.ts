import { CalcBusEngine } from './workers/calc/calc.bus';
import { CalcBusInputDataSettings, masks, xyWidthBits } from './workers/calc/calc.model';
import { DoubleLinkedList } from './models/double-linked-list.model';
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
	STANDARD,
}

export class Interaction {
	protected static buffer: Set<number> = new Set();
	protected static bufferInteraction: DoubleLinkedList<InteractionEntry> = new DoubleLinkedList<InteractionEntry>();
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
	protected static gameover: boolean;
	protected static interactionRequest: number;
	protected static mode: InteractionMode = InteractionMode.STANDARD;
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
		let cameraRelX: number = 0,
			cameraRelY: number = 0,
			cameraUpdated: boolean = false,
			cameraZoom: number = 100,
			cameraZoomMax: number = 100,
			cameraZoomMin: number = 1,
			cameraZoomPrevious: number,
			cameraZoomStep: number = 1,
			down: boolean,
			downMode: boolean,
			entry: InteractionEntry | undefined,
			mode: InteractionMode = InteractionMode.STANDARD,
			move: boolean,
			position: MousePosition | TouchPosition,
			position2: MousePosition | TouchPosition,
			touch: boolean,
			touchDistance: number,
			touchDistancePrevious: number = -1,
			touchDistanceRelX: number,
			touchDistanceRelY: number,
			zoom: boolean;

		// Limit how often a camera update can be sent via the bus
		setInterval(() => {
			if (cameraUpdated) {
				cameraUpdated = false;

				VideoBusEngine.outputCamera({
					relX: cameraRelX,
					relY: cameraRelY,
					zoom: cameraZoom,
				});
			}
		}, 40);

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

				// Pull data
				if (entry.down !== undefined) {
					down = entry.down;
				}
				// move = entry.move;
				position = entry.position;
				position2 = entry.position2;
				touch = entry.touch;
				zoom = entry.zoom;

				// Mode variables
				if (mode !== Interaction.mode) {
					mode = Interaction.mode;

					touchDistancePrevious = -1; // Reset touch based zoom
				}

				if (mode === InteractionMode.STANDARD) {
					// Modify "camera"
					if (zoom) {
						// Zoom
						if (touch) {
							// Touch
							if (touchDistancePrevious !== -1) {
								touchDistance = <number>(<TouchPosition>entry.position).distance - touchDistancePrevious;
								if (Math.abs(touchDistance) > 100) {
									cameraZoomPrevious = cameraZoom;
									cameraZoom = Math.max(
										cameraZoomMin,
										Math.min(cameraZoomMax, cameraZoom + (touchDistance > 0 ? cameraZoomStep : -cameraZoomStep)),
									);

									if (cameraZoom !== cameraZoomPrevious) {
										cameraRelX = touchDistanceRelX;
										cameraRelY = touchDistanceRelY;
										cameraUpdated = true;
									}
								}
							} else {
								touchDistancePrevious = <number>(<TouchPosition>entry.position).distance;
								touchDistanceRelX = (position.xRel + position2.xRel) / 2;
								touchDistanceRelY = (position.xRel + position2.xRel) / 2;
							}
						} else {
							touchDistancePrevious = -1; // Reset touch based zoom

							// Mouse
							cameraZoomPrevious = cameraZoom;
							cameraZoom = Math.max(
								cameraZoomMin,
								Math.min(cameraZoomMax, cameraZoom + (down ? cameraZoomStep : -cameraZoomStep)),
							);

							down = false;
							if (cameraZoom !== cameraZoomPrevious) {
								cameraRelX = position.xRel;
								cameraRelY = position.yRel;
								cameraUpdated = true;
							}
						}
					} else {
						touchDistancePrevious = -1; // Reset touch based zoom

						if (!entry.move) {
							downMode = down;
						}

						// Move
						if (downMode && cameraRelX !== position.xRel && cameraRelY !== position.yRel) {
							cameraRelX = position.xRel;
							cameraRelY = position.yRel;
							cameraUpdated = true;
						}
					}
				} else {
				}

				// // Standard edit interaction
				// if (Interaction.mode !== null) {
				// 	const buffer = Interaction.buffer,
				// 		devicePixelRatio: number = Math.round(window.devicePixelRatio * 1000) / 1000,
				// 		domRect: DOMRect = Interaction.domRect,
				// 		elementEditStyle: CSSStyleDeclaration = Interaction.elementEdit.style,
				// 		pxCellSize: number = Interaction.pxCellSize;

				// 	let out: boolean = false,
				// 		px: number = position.x / devicePixelRatio,
				// 		py: number = position.y / devicePixelRatio,
				// 		tx: number,
				// 		ty: number;

				// 	if (Interaction.rotated) {
				// 		px = position.y / devicePixelRatio;
				// 		py = domRect.width - position.x / devicePixelRatio;

				// 		if (px === 0 || py === 0 || py === domRect.width || px === domRect.height) {
				// 			out = true;
				// 		}
				// 	} else {
				// 		if (px === 0 || py === 0 || px === domRect.width || py === domRect.height) {
				// 			out = true;
				// 		}
				// 	}

				// 	tx = (px / pxCellSize) | 0;
				// 	ty = (py / pxCellSize) | 0;

				// 	px = tx * pxCellSize;
				// 	py = ty * pxCellSize;

				// 	if (move) {
				// 		if (out) {
				// 			Interaction.editActive = false;
				// 			elementEditStyle.display = 'none';
				// 		} else {
				// 			if (!touch) {
				// 				elementEditStyle.display = 'block';

				// 				elementEditStyle.left = px + 'px';
				// 				elementEditStyle.top = py + 'px';
				// 			} else {
				// 				elementEditStyle.display = 'none';
				// 			}

				// 			if (Interaction.editActive) {
				// 				buffer.add((tx << xyWidthBits) | ty | (Interaction.mode ? xyValueAlive : xyValueDead));
				// 			}
				// 		}
				// 	} else if (!out) {
				// 		Interaction.editActive = down;

				// 		// Single touches can be registered a click by the browser
				// 		if (!touch || Interaction.mobile) {
				// 			elementEditStyle.display = 'none';
				// 		}

				// 		if (down) {
				// 			if (!touch) {
				// 				buffer.add((tx << xyWidthBits) | ty | (Interaction.mode ? xyValueAlive : xyValueDead));
				// 			}

				// 			clearInterval(Interaction.editInterval);
				// 			Interaction.editInterval = setInterval(() => {
				// 				if (buffer.size) {
				// 					CalcBusEngine.outputLife(Uint32Array.from(buffer));
				// 					buffer.clear();
				// 				}
				// 			}, 40);
				// 		} else {
				// 			clearInterval(Interaction.editInterval);
				// 			if (buffer.size) {
				// 				CalcBusEngine.outputLife(Uint32Array.from(buffer));
				// 				buffer.clear();
				// 			}
				// 		}
				// 	}
				// } else if (touch) {
				// 	// Swipe for speedup or speeddown
				// 	const domRect: DOMRect = Interaction.domRect;

				// 	let now: number,
				// 		out: boolean = false,
				// 		px: number = position.x / devicePixelRatio,
				// 		py: number = position.y / devicePixelRatio;

				// 	if (px === 0 || py === 0 || px === domRect.width || py === domRect.height) {
				// 		out = true;
				// 	}

				// 	if (move) {
				// 		if (out) {
				// 			Interaction.editActive = false;
				// 		} else if (Interaction.editActive) {
				// 			console.log('ADD', px - Interaction.swipePositionPrevious);
				// 			Interaction.swipeLength += px - Interaction.swipePositionPrevious;
				// 			Interaction.swipePositionPrevious = px;
				// 		}
				// 	} else if (!out) {
				// 		Interaction.editActive = down;

				// 		if (down) {
				// 			Interaction.swipeLength = 0;
				// 			Interaction.swipePositionPrevious = px;

				// 			clearInterval(Interaction.editInterval);
				// 			Interaction.editInterval = setInterval(() => {
				// 				if (Math.abs(Interaction.swipeLength) > Interaction.swipeLengthAccepted) {
				// 					console.log('GOT!', Interaction.swipeLength);

				// 					let forward: boolean = Interaction.swipeLength > 0;
				// 					Interaction.swipeLength = 0;
				// 					Interaction.moved = true;
				// 					Interaction.swipePositionPrevious = px;

				// 					if (forward) {
				// 						Interaction.elementControlsForwardFunc();
				// 					} else {
				// 						Interaction.elementControlsBackwardFunc();
				// 					}
				// 				} else {
				// 					console.log('PASS', Interaction.swipeLength);
				// 				}
				// 			}, 40);
				// 		} else {
				// 			now = performance.now();
				// 			if (now - Interaction.touchUpTimestamp < Interaction.touchDoubleWindow) {
				// 				if (Interaction.elementControlsPlay.style.display !== 'none') {
				// 					Interaction.elementControlsPlayFunc();
				// 				} else {
				// 					Interaction.elementControlsPauseFunc();
				// 				}

				// 				clearTimeout(Interaction.touchDownClickTimeout);
				// 				Interaction.touchUpTimestamp = 0;
				// 			} else {
				// 				Interaction.touchUpTimestamp = now;
				// 			}

				// 			console.log('FINAL');
				// 			clearInterval(Interaction.editInterval);
				// 			if (Math.abs(Interaction.swipeLength) > Interaction.swipeLengthAccepted) {
				// 				if (Interaction.swipeLength > 0) {
				// 					Interaction.elementControlsForwardFunc();
				// 				} else {
				// 					Interaction.elementControlsBackwardFunc();
				// 				}

				// 				Interaction.moved = true;
				// 				Interaction.swipeLength = 0;
				// 				Interaction.swipePositionPrevious = px;
				// 			} else if (!Interaction.moved) {
				// 				clearTimeout(Interaction.touchDownClickTimeout);
				// 				Interaction.touchDownClickTimeout = setTimeout(() => {
				// 					Interaction.elementCanvasInteractive.click();
				// 				}, Interaction.touchDoubleWindow + 100);
				// 			}

				// 			Interaction.moved = false;
				// 		}
				// 	}
				// }
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
