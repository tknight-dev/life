import { CalcBusEngine } from '../workers/calc/calc.bus';
import { CalcBusInputDataSettings, masks, scale, scalePx, xyWidthBits } from '../workers/calc/calc.model';
import { DOM } from './dom';
import { VideoBusInputDataSettings, VideoBusOutputDataCamera } from '../workers/video/video.model';
import { VideoBusEngine } from '../workers/video/video.bus';
import {
	GamingCanvas,
	GamingCanvasInput,
	GamingCanvasInputGamepad,
	GamingCanvasInputGamepadControllerType,
	GamingCanvasInputGamepadControllerTypeMapAxes,
	GamingCanvasInputGamepadControllerTypeMappedAxes,
	GamingCanvasInputKeyboard,
	GamingCanvasInputMouse,
	GamingCanvasInputMouseAction,
	GamingCanvasInputPosition,
	GamingCanvasInputPositionDistance,
	GamingCanvasInputTouch,
	GamingCanvasInputTouchAction,
	GamingCanvasInputType,
	GamingCanvasOptions,
	GamingCanvasReport,
	GamingCanvasFIFOQueue,
} from '@tknight-dev/gaming-canvas';

/**
 * @author tknight-dev
 */

const { xyValueAlive, xyValueDead } = masks;

export enum InteractionMode {
	DRAW_LIFE,
	DRAW_DEATH,
	ERASE,
	MOVE_ZOOM,
}

export class Interaction extends DOM {
	protected static cameraViewportHeightC: number = 0;
	protected static cameraViewportStartXC: number = 0;
	protected static cameraViewportStartYC: number = 0;
	protected static cameraViewportWidthC: number = 0;
	protected static cameraReset: boolean;
	protected static cameraZoom: number = 1;
	protected static editActive: boolean;
	protected static editInterval: ReturnType<typeof setInterval>;
	protected static elementControlsBackwardFunc: () => void;
	protected static elementControlsForwardFunc: () => void;
	protected static elementControlsPauseFunc: () => void;
	protected static elementControlsPlayFunc: () => void;
	protected static elementControlsResetFunc: () => void;
	protected static fullscreenClickFunc: () => void;
	protected static gamepadNotCompatibleTimeout: ReturnType<typeof setTimeout>;
	protected static gameover: boolean;
	protected static inputRequest: number;
	protected static mode: InteractionMode = InteractionMode.MOVE_ZOOM;
	protected static mobile: boolean;
	protected static moved: boolean;
	protected static settingsCalc: CalcBusInputDataSettings;
	protected static readonly settingsCalcIPSMax: number = 1024;
	protected static settingsGamingCanvas: GamingCanvasOptions;
	protected static settingsRotateAutoEnable: boolean;
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
		Interaction.mobile = Interaction.isMobileOrTablet();

		// Engines
		GamingCanvas.setCallbackReport((report: GamingCanvasReport) => {
			VideoBusEngine.resized(report);
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

		// // Done
		Interaction.processorBinder();
		Interaction.inputRequest = requestAnimationFrame(Interaction.processor);
		setTimeout(() => {
			Interaction.pxSizeCalc();
		}, 100);
	}

	private static processor(_: number): void {}

	private static processorBinder(): void {
		let buffer: Set<number> = new Set(),
			cameraMove: boolean,
			cameraRelX: number,
			cameraRelY: number,
			cameraUpdated: boolean,
			cameraViewportHeightC: number = 0,
			cameraViewportStartXC: number = 0,
			cameraViewportStartYC: number = 0,
			cameraViewportWidthC: number = 0,
			cameraZoom: number,
			cameraZoomMax: number = 100,
			cameraZoomMin: number = 1,
			cameraZoomPrevious: number = cameraZoomMin,
			cameraZoomStep: number = 5,
			down: boolean,
			downMode: boolean,
			elementEditStyle: CSSStyleDeclaration = DOM.elementEdit.style,
			gamepadAxes: GamingCanvasInputGamepadControllerTypeMappedAxes | null,
			gamepadX: number = 0,
			gamepadY: number = 0,
			gamepadZoom: number = 0,
			inputLimitPerMs: number = GamingCanvas.getInputLimitPerMs(),
			mode: InteractionMode = InteractionMode.MOVE_ZOOM,
			position1: GamingCanvasInputPosition,
			position2: GamingCanvasInputPosition,
			positions: GamingCanvasInputPosition[] | undefined,
			pxCellSize: number,
			queue: GamingCanvasFIFOQueue<GamingCanvasInput> = GamingCanvas.getInputQueue(),
			queueInput: GamingCanvasInput | undefined,
			queueInputOverlay: GamingCanvasInput,
			queueTimestamp: number = -2025,
			touchDistance: number,
			touchDistancePrevious: number = -1,
			value: number,
			x: number,
			y: number;

		// Limit how often a camera update can be sent via the bus
		setInterval(() => {
			if (cameraUpdated) {
				cameraUpdated = false;

				if (Interaction.cameraZoom !== cameraZoom) {
					Interaction.cameraZoom = cameraZoom;
					Interaction.pxSizeCalc();

					// Vibrate if at max or min zoom
					if (cameraZoom === cameraZoomMax || cameraZoom === cameraZoomMin) {
						GamingCanvas.isVibrateSupported() && GamingCanvas.vibrate([100]);
					}
				}

				VideoBusEngine.outputCamera({
					move: cameraMove,
					relX: cameraRelX,
					relY: cameraRelY,
					zoom: cameraZoom,
				});
			}
		}, inputLimitPerMs);

		Interaction.cameraReset = true;
		const processor = (timestampNow: number) => {
			Interaction.inputRequest = requestAnimationFrame(processor);

			if (Interaction.cameraReset) {
				Interaction.cameraReset = false;

				// Default
				cameraMove = false;
				cameraRelX = 0.5;
				cameraRelY = 0.5;
				cameraZoom = 1;

				// Reset
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

			if (timestampNow - queueTimestamp > inputLimitPerMs) {
				queueTimestamp = timestampNow;

				// Update temporary values
				cameraViewportHeightC = Interaction.cameraViewportHeightC;
				cameraViewportStartXC = Interaction.cameraViewportStartXC;
				cameraViewportStartYC = Interaction.cameraViewportStartYC;
				cameraViewportWidthC = Interaction.cameraViewportWidthC;
				pxCellSize = Interaction.pxCellSize;
				mode = Interaction.mode;

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

				while ((queueInput = queue.pop())) {
					switch (queueInput.type) {
						case GamingCanvasInputType.GAMEPAD:
							processorGamepad(queueInput);
							break;
						case GamingCanvasInputType.KEYBOARD:
							processorKeyboard(queueInput);
							break;
						case GamingCanvasInputType.MOUSE:
							queueInputOverlay = JSON.parse(JSON.stringify(queueInput));
							GamingCanvas.relativizeInputToCanvas(queueInput);
							processorMouse(queueInput, queueInputOverlay);
							break;
						case GamingCanvasInputType.TOUCH:
							GamingCanvas.relativizeInputToCanvas(queueInput);
							processorTouch(queueInput);
							break;
					}
				}
			}
		};
		Interaction.processor = processor;

		setInterval(() => {
			if (mode == InteractionMode.MOVE_ZOOM) {
				if (gamepadX !== 0 || gamepadY !== 0) {
					cameraMove = true;
					cameraRelX -= gamepadX / 30;
					cameraRelY -= gamepadY / 30;
					cameraUpdated = true;
				}

				if (gamepadZoom !== 0) {
					cameraZoomPrevious = cameraZoom;
					cameraZoom = Math.max(cameraZoomMin, Math.min(cameraZoomMax, cameraZoom + cameraZoomStep * gamepadZoom));
					downMode = false;
					if (cameraZoom !== cameraZoomPrevious) {
						cameraUpdated = true;
					}
				}
			}
		}, 40); // how often the state is applied
		const processorGamepad = (input: GamingCanvasInputGamepad) => {
			// Check the connection state
			if (input.propriatary.connected) {
				if (input.propriatary.type === GamingCanvasInputGamepadControllerType.XBOX) {
					if (input.propriatary.axes) {
						gamepadAxes = GamingCanvasInputGamepadControllerTypeMapAxes(input);

						if (gamepadAxes !== null) {
							if (mode == InteractionMode.MOVE_ZOOM) {
								gamepadX = gamepadAxes.stickLeftX;
								gamepadY = gamepadAxes.stickLeftY;

								gamepadZoom = Math.max(
									-1,
									Math.min(1, gamepadAxes.stickRightY + gamepadAxes.triggerRight - gamepadAxes.triggerLeft),
								);
							}
						}
					}

					// if (input.propriatary.buttons) {
					//     for (const [buttonNumber, pressed] of Object.entries(input.propriatary.buttons)) {
					//         switch (Number(buttonNumber)) {
					//             case GamingCanvasInputGamepadControllerTypeXboxButtons.DPAD_UP:
					//                 // Move player up
					//                 break;
					//         }
					//     }
					// }
				} else {
					// Not a support controller
					clearTimeout(Interaction.gamepadNotCompatibleTimeout);
					DOM.elementGamepadNotCompatible.style.display = 'flex';
					setTimeout(() => {
						DOM.elementGamepadNotCompatible.classList.add('show');

						Interaction.gamepadNotCompatibleTimeout = setTimeout(() => {
							DOM.elementGamepadNotCompatible.classList.remove('show');

							Interaction.gamepadNotCompatibleTimeout = setTimeout(() => {
								DOM.elementGamepadNotCompatible.style.display = 'none';
							}, 1000);
						}, 1000);
					}, 10);
				}
			}
		};

		const processorKeyboard = (input: GamingCanvasInputKeyboard) => {
			if (input.propriatary.down) {
				switch (input.propriatary.action.code) {
					case 'ArrowLeft':
						DOM.elementControlsBackward.click();
						break;
					case 'ArrowRight':
						DOM.elementControlsForward.click();
						break;
					case 'KeyF':
						DOM.elementFullscreen.click();
						break;
					case 'KeyR':
						DOM.elementControlsReset.click();
						break;
					case 'Space':
						if (DOM.elementControlsPlay.style.display === 'none') {
							DOM.elementControlsPause.click();
						} else {
							DOM.elementControlsPlay.click();
						}
						break;
				}
			}
		};

		const processorMouse = (input: GamingCanvasInputMouse, inputOverlay: GamingCanvasInputMouse) => {
			position1 = input.propriatary.position;
			if (input.propriatary.down !== undefined) {
				down = input.propriatary.down;
			}
			if (position1.out) {
				down = false;
			}

			switch (input.propriatary.action) {
				case GamingCanvasInputMouseAction.LEFT:
					if (mode == InteractionMode.MOVE_ZOOM) {
						downMode = down;
						VideoBusEngine.outputCamera({
							move: false,
							relX: 1 - position1.xRelative,
							relY: 1 - position1.yRelative,
							zoom: cameraZoom,
						});
					} else {
						Interaction.fullscreenClickFunc();
						Interaction.editActive = down;
						if (down) {
							buffer.add(
								(((cameraViewportStartXC + cameraViewportWidthC * position1.xRelative) | 0) << xyWidthBits) |
									((cameraViewportStartYC + cameraViewportHeightC * position1.yRelative) | 0) |
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
					break;
				case GamingCanvasInputMouseAction.MOVE:
					if (mode == InteractionMode.MOVE_ZOOM) {
						if (downMode && !position1.out && cameraRelX !== position1.xRelative && cameraRelY !== position1.yRelative) {
							cameraMove = true;
							cameraRelX = 1 - position1.xRelative;
							cameraRelY = 1 - position1.yRelative;
							cameraUpdated = true;
						}
					} else {
						x = inputOverlay.propriatary.position.x;
						y = inputOverlay.propriatary.position.y;

						elementEditStyle.display = 'block';
						elementEditStyle.left = x - ((x + (cameraViewportStartXC % 1) * pxCellSize) % pxCellSize) + 'px';
						elementEditStyle.top = y - ((y + (cameraViewportStartYC % 1) * pxCellSize) % pxCellSize) + 'px';

						if (Interaction.editActive) {
							buffer.add(
								(((cameraViewportStartXC + cameraViewportWidthC * position1.xRelative) | 0) << xyWidthBits) |
									((cameraViewportStartYC + cameraViewportHeightC * position1.yRelative) | 0) |
									value,
							);
						}
					}
					break;
				case GamingCanvasInputMouseAction.SCROLL:
					if (mode == InteractionMode.MOVE_ZOOM) {
						cameraZoomPrevious = cameraZoom;
						cameraZoom = Math.max(
							cameraZoomMin,
							Math.min(cameraZoomMax, cameraZoom + (down ? -cameraZoomStep : cameraZoomStep)),
						);
						downMode = false;
						if (cameraZoom !== cameraZoomPrevious) {
							cameraUpdated = true;
						}
					} else {
						// Scale up draw size?
					}
					break;
			}
		};

		const processorTouch = (input: GamingCanvasInputTouch) => {
			elementEditStyle.display = 'none';
			positions = input.propriatary.positions;
			if (input.propriatary.down !== undefined) {
				down = input.propriatary.down;
			}

			switch (input.propriatary.action) {
				case GamingCanvasInputTouchAction.ACTIVE:
					if (mode == InteractionMode.MOVE_ZOOM) {
						!cameraMove && !down && Interaction.fullscreenClickFunc();
						cameraMove = false;
						downMode = down;
						touchDistancePrevious = -1;

						if (down && positions && positions.length === 1) {
							position1 = positions[0];

							VideoBusEngine.outputCamera({
								move: false,
								relX: 1 - position1.xRelative,
								relY: 1 - position1.yRelative,
								zoom: cameraZoom,
							});
						}
					} else {
						Interaction.fullscreenClickFunc();
						Interaction.editActive = down;
						if (down && positions) {
							position1 = positions[0];

							buffer.add(
								(((cameraViewportStartXC + cameraViewportWidthC * position1.xRelative) | 0) << xyWidthBits) |
									((cameraViewportStartYC + cameraViewportHeightC * position1.yRelative) | 0) |
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
					break;
				case GamingCanvasInputTouchAction.MOVE:
					if (mode == InteractionMode.MOVE_ZOOM) {
						if (positions) {
							position1 = positions[0];

							if (position1.out) {
								down = false;
							}

							if (positions.length > 1) {
								// Zoom
								if (down) {
									position2 = positions[1];

									if (touchDistancePrevious !== -1) {
										touchDistance = GamingCanvasInputPositionDistance(position1, position2) - touchDistancePrevious;
										if (Math.abs(touchDistance) > 20) {
											cameraZoomPrevious = cameraZoom;
											cameraZoom = Math.max(
												cameraZoomMin,
												Math.min(
													cameraZoomMax,
													cameraZoom + (touchDistance > 0 ? cameraZoomStep : -cameraZoomStep),
												),
											);
											if (cameraZoom !== cameraZoomPrevious) {
												cameraUpdated = true;
											}
											touchDistancePrevious = touchDistance + touchDistancePrevious;
										}
									} else {
										touchDistancePrevious = GamingCanvasInputPositionDistance(position1, position2);
									}
								} else {
									touchDistancePrevious = -1;
								}
							} else {
								touchDistancePrevious = -1;

								// Move
								if (downMode && cameraRelX !== position1.xRelative && cameraRelY !== position1.yRelative) {
									cameraMove = true;
									cameraRelX = 1 - position1.xRelative;
									cameraRelY = 1 - position1.yRelative;
									cameraUpdated = true;
								}
							}
						}
					} else {
						if (Interaction.editActive && positions) {
							position1 = positions[0];

							buffer.add(
								(((cameraViewportStartXC + cameraViewportWidthC * position1.xRelative) | 0) << xyWidthBits) |
									((cameraViewportStartYC + cameraViewportHeightC * position1.yRelative) | 0) |
									value,
							);
						}
					}
					break;
			}
		};
	}

	protected static pxSizeCalc(): void {
		const report: GamingCanvasReport = GamingCanvas.getReport();

		let pxCellSize: number = Math.max(1, report.canvasWidth / Interaction.settingsVideo.tableSizeX);

		if (Interaction.cameraZoom !== 1) {
			pxCellSize *= scalePx(Interaction.cameraZoom, Interaction.settingsVideo.tableSizeX);
		}

		pxCellSize = Math.round(pxCellSize * report.scaler * 1000) / 1000;

		DOM.elementEdit.style.height = pxCellSize + 'px';
		DOM.elementEdit.style.width = pxCellSize + 'px';
		Interaction.pxCellSize = pxCellSize;
	}

	protected static spinner(enable: boolean) {
		if (enable) {
			clearTimeout(Interaction.spinnerTimeout);

			Interaction.spinnerTimeout = setTimeout(() => {
				if (DOM.elementSpinner.style.display !== 'flex') {
					DOM.elementSpinner.classList.remove('show');
					DOM.elementSpinner.style.display = 'flex';

					setTimeout(() => {
						DOM.elementSpinner.classList.add('show');
					}, 10);
				} else {
					DOM.elementSpinner.classList.add('show');
				}
			}, 100);
		} else {
			clearTimeout(Interaction.spinnerTimeout);

			DOM.elementSpinner.classList.remove('show');

			Interaction.spinnerTimeout = setTimeout(() => {
				DOM.elementSpinner.style.display = 'none';
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
