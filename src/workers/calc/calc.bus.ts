/**
 * @author tknight-dev
 */

// import { AssetDeclarations } from '../../models/asset.model';
// import { AudioEngine } from '../audio.engine';
// import { KeyAction } from '../keyboard.engine';
// import { MapActive, MapConfig } from '../../models/map.model';
// import { MapEngine } from '../map.engine';
// import { MouseAction } from '../mouse.engine';
// import { TouchAction } from '../touch.engine';
// import { ResizeEngine } from '../resize.engine';
// import {
// 	VideoBusInputCmd,
// 	VideoBusInputCmdGameModeEdit,
// 	VideoBusInputCmdGameModeEditApply,
// 	VideoBusInputCmdGameModeEditDraw,
// 	VideoBusInputCmdGameModePlay,
// 	VideoBusInputCmdGamePause,
// 	VideoBusInputCmdGameSave,
// 	VideoBusInputCmdGameStart,
// 	VideoBusInputCmdGameUnpause,
// 	VideoBusInputCmdInit,
// 	VideoBusInputCmdResize,
// 	VideoBusInputCmdSettings,
// 	VideoBusPayload,
// 	VideoBusOutputCmd,
// 	VideoBusOutputCmdAudioFade,
// 	VideoBusOutputCmdAudioPause,
// 	VideoBusOutputCmdAudioPlay,
// 	VideoBusOutputCmdAudioStop,
// 	VideoBusOutputCmdAudioUnpause,
// 	VideoBusOutputCmdEditCameraUpdate,
// 	VideoBusOutputCmdMapAsset,
// 	VideoBusOutputCmdMapLoadStatus,
// 	VideoBusOutputCmdMapSave,
// 	VideoBusOutputCmdRumble,
// 	VideoBusWorkerPayload,
// 	VideoBusWorkerStatusInitialized,
// } from '../../engines/buses/video.model.bus';
// import { UtilEngine } from '../util.engine';

// export class VideoEngineBus {
// 	private static callbackEditCameraUpdate: (update: VideoBusOutputCmdEditCameraUpdate) => void;
// 	private static callbackEditComplete: () => void;
// 	private static callbackFPS: (fps: number) => void;
// 	private static callbackMapAsset: (mapActive: MapActive | undefined) => void;
// 	private static callbackMapHourOfDayEff: (hourOfDayEff: number) => void;
// 	private static callbackMapLoadStatus: (status: boolean) => void;
// 	private static callbackMapSave: (data: string, name: string) => void;
// 	private static callbackRumble: (durationInMs: number, enable: boolean, intensity: number) => void;
// 	private static callbackStatusInitialized: (durationInMs: number) => void;
// 	private static canvases: HTMLCanvasElement[];
// 	private static canvasesOffscreen: OffscreenCanvas[];
// 	private static complete: boolean;
// 	private static initialized: boolean;
// 	private static mapInteration: HTMLElement;
// 	private static resolution: null | number;
// 	private static streams: HTMLElement;
// 	private static worker: Worker;

// 	/**
// 	 * Start the video streams in another thread
// 	 */
// 	public static async initialize(
// 		assetDeclarations: AssetDeclarations,
// 		streams: HTMLElement,
// 		canvasBackground1: HTMLCanvasElement,
// 		canvasBackground2: HTMLCanvasElement,
// 		canvasForeground1: HTMLCanvasElement,
// 		canvasForeground2: HTMLCanvasElement,
// 		canvasInteractive: HTMLCanvasElement,
// 		canvasMiddleground: HTMLCanvasElement,
// 		canvasOverlay: HTMLCanvasElement,
// 		canvasUnderlay: HTMLCanvasElement,
// 		canvasVanishing: HTMLCanvasElement,
// 		mapInteration: HTMLElement,
// 		settings: VideoBusInputCmdSettings,
// 	): Promise<void> {
// 		if (VideoEngineBus.initialized) {
// 			console.error('VideoEngineBus > initialize: already initialized');
// 			return;
// 		}
// 		VideoEngineBus.initialized = true;

// 		let videoBusInputCmdInit: VideoBusInputCmdInit, videoBusInputCmdResize: VideoBusInputCmdResize, videoBusPayload: VideoBusPayload;

// 		// Cache
// 		VideoEngineBus.canvases = [
// 			canvasBackground1,
// 			canvasBackground2,
// 			canvasForeground1,
// 			canvasForeground2,
// 			canvasInteractive,
// 			canvasMiddleground,
// 			canvasOverlay,
// 			canvasUnderlay,
// 			canvasVanishing,
// 		];
// 		VideoEngineBus.canvasesOffscreen = [
// 			canvasBackground1.transferControlToOffscreen(),
// 			canvasBackground2.transferControlToOffscreen(),
// 			canvasForeground1.transferControlToOffscreen(),
// 			canvasForeground2.transferControlToOffscreen(),
// 			canvasInteractive.transferControlToOffscreen(),
// 			canvasMiddleground.transferControlToOffscreen(),
// 			canvasOverlay.transferControlToOffscreen(),
// 			canvasUnderlay.transferControlToOffscreen(),
// 			canvasVanishing.transferControlToOffscreen(),
// 		];

// 		VideoEngineBus.mapInteration = mapInteration;
// 		VideoEngineBus.streams = streams;

// 		// Config
// 		VideoEngineBus.resolution = settings.resolution;
// 		ResizeEngine.setCallback(VideoEngineBus.resized);

// 		// Spawn Video thread
// 		if (window.Worker) {
// 			VideoEngineBus.worker = new Worker(new URL('../workers/video.worker.engine', import.meta.url), {
// 				name: 'VideoWorkerEngine',
// 			});

// 			// Setup listener
// 			VideoEngineBus.input();

// 			/*
// 			 * Initialization payload
// 			 */
// 			videoBusInputCmdResize = VideoEngineBus.resized(true);
// 			videoBusInputCmdInit = Object.assign(
// 				{
// 					assetDeclarations: assetDeclarations,
// 					canvasOffscreenBackground1: VideoEngineBus.canvasesOffscreen[0],
// 					canvasOffscreenBackground2: VideoEngineBus.canvasesOffscreen[1],
// 					canvasOffscreenForeground1: VideoEngineBus.canvasesOffscreen[2],
// 					canvasOffscreenForeground2: VideoEngineBus.canvasesOffscreen[3],
// 					canvasOffscreenInteractive: VideoEngineBus.canvasesOffscreen[4],
// 					canvasOffscreenMiddleground: VideoEngineBus.canvasesOffscreen[5],
// 					canvasOffscreenOverlay: VideoEngineBus.canvasesOffscreen[6],
// 					canvasOffscreenUnderlay: VideoEngineBus.canvasesOffscreen[7],
// 					canvasOffscreenVanishing: VideoEngineBus.canvasesOffscreen[8],
// 				},
// 				videoBusInputCmdResize,
// 				settings,
// 			);
// 			videoBusPayload = {
// 				cmd: VideoBusInputCmd.INIT,
// 				data: videoBusInputCmdInit,
// 			};
// 			VideoEngineBus.worker.postMessage(videoBusPayload, VideoEngineBus.canvasesOffscreen);
// 			VideoEngineBus.complete = true;
// 		} else {
// 			alert('Web Workers are not supported by your browser');
// 		}
// 	}

// 	/*
// 	 * Commands from worker (typically audio effect triggers)
// 	 */
// 	private static input(): void {
// 		let bufferId: number | undefined,
// 			bufferIds: { [key: number]: number | undefined },
// 			videoBusOutputCmdAudioFade: VideoBusOutputCmdAudioFade,
// 			videoBusOutputCmdAudioPause: VideoBusOutputCmdAudioPause,
// 			videoBusOutputCmdAudioPlay: VideoBusOutputCmdAudioPlay,
// 			videoBusOutputCmdAudioStop: VideoBusOutputCmdAudioStop,
// 			videoBusOutputCmdAudioUnpause: VideoBusOutputCmdAudioUnpause,
// 			videoBusOutputCmdEditCameraUpdate: VideoBusOutputCmdEditCameraUpdate,
// 			videoBusOutputCmdMapAsset: VideoBusOutputCmdMapAsset,
// 			videoBusOutputCmdMapLoadStatus: VideoBusOutputCmdMapLoadStatus,
// 			videoBusOutputCmdMapSave: VideoBusOutputCmdMapSave,
// 			videoBusOutputCmdRumble: VideoBusOutputCmdRumble,
// 			videoBusWorkerPayload: VideoBusWorkerPayload,
// 			videoBusWorkerPayloads: VideoBusWorkerPayload[],
// 			videoBusWorkerStatusInitialized: VideoBusWorkerStatusInitialized;

// 		VideoEngineBus.worker.onmessage = async (event: MessageEvent) => {
// 			bufferIds = <any>new Object();
// 			videoBusWorkerPayloads = event.data.payloads;

// 			for (let i = 0; i < videoBusWorkerPayloads.length; i++) {
// 				videoBusWorkerPayload = videoBusWorkerPayloads[i];

// 				switch (videoBusWorkerPayload.cmd) {
// 					case VideoBusOutputCmd.AUDIO_FADE:
// 						videoBusOutputCmdAudioFade = <VideoBusOutputCmdAudioFade>videoBusWorkerPayload.data;
// 						AudioEngine.controlFade(
// 							videoBusOutputCmdAudioFade.bufferId,
// 							videoBusOutputCmdAudioFade.durationInMs,
// 							videoBusOutputCmdAudioFade.volumePercentage,
// 						);
// 						break;
// 					case VideoBusOutputCmd.AUDIO_PAUSE:
// 						videoBusOutputCmdAudioPause = <VideoBusOutputCmdAudioPause>videoBusWorkerPayload.data;
// 						AudioEngine.controlPause(videoBusOutputCmdAudioPause.bufferId);
// 						break;
// 					case VideoBusOutputCmd.AUDIO_PLAY:
// 						videoBusOutputCmdAudioPlay = <VideoBusOutputCmdAudioPlay>videoBusWorkerPayload.data;
// 						bufferId = await AudioEngine.controlPlay(videoBusOutputCmdAudioPlay.id, videoBusOutputCmdAudioPlay.audioOptions);
// 						if (videoBusOutputCmdAudioPlay.transactionId !== undefined) {
// 							bufferIds[videoBusOutputCmdAudioPlay.transactionId] = bufferId;
// 						}
// 						break;
// 					case VideoBusOutputCmd.AUDIO_STOP:
// 						videoBusOutputCmdAudioStop = <VideoBusOutputCmdAudioStop>videoBusWorkerPayload.data;
// 						AudioEngine.controlStop(videoBusOutputCmdAudioStop.bufferId);
// 						break;
// 					case VideoBusOutputCmd.AUDIO_UNPAUSE:
// 						videoBusOutputCmdAudioUnpause = <VideoBusOutputCmdAudioUnpause>videoBusWorkerPayload.data;
// 						AudioEngine.controlUnpause(videoBusOutputCmdAudioUnpause.bufferId);
// 						break;
// 					case VideoBusOutputCmd.EDIT_CAMERA_UPDATE:
// 						videoBusOutputCmdEditCameraUpdate = <VideoBusOutputCmdEditCameraUpdate>videoBusWorkerPayload.data;
// 						if (VideoEngineBus.callbackEditCameraUpdate !== undefined) {
// 							VideoEngineBus.callbackEditCameraUpdate(videoBusOutputCmdEditCameraUpdate);
// 						} else {
// 							console.error('VideoEngineBus > input: edit camera update callback not set');
// 						}
// 						break;
// 					case VideoBusOutputCmd.EDIT_COMPLETE:
// 						if (VideoEngineBus.callbackEditComplete !== undefined) {
// 							VideoEngineBus.callbackEditComplete();
// 						} else {
// 							console.error('VideoEngineBus > input: edit complete callback not set');
// 						}
// 						break;
// 					case VideoBusOutputCmd.FPS:
// 						if (VideoEngineBus.callbackFPS !== undefined) {
// 							VideoEngineBus.callbackFPS(<number>videoBusWorkerPayload.data);
// 						} else {
// 							console.error('VideoEngineBus > input: fps callback not set');
// 						}
// 						break;
// 					case VideoBusOutputCmd.MAP_ASSET:
// 						videoBusOutputCmdMapAsset = <VideoBusOutputCmdMapAsset>videoBusWorkerPayload.data;
// 						if (VideoEngineBus.callbackMapAsset !== undefined) {
// 							if (videoBusOutputCmdMapAsset.mapActive) {
// 								VideoEngineBus.callbackMapAsset(
// 									MapEngine.loadFromFile(UtilEngine.mapDecode(videoBusOutputCmdMapAsset.mapActive)),
// 								);
// 							} else {
// 								VideoEngineBus.callbackMapAsset(undefined);
// 							}
// 						} else {
// 							console.error('VideoEngineBus > input: map asset callback not set');
// 						}
// 						break;
// 					case VideoBusOutputCmd.MAP_HOUR_OF_DAY_EFF:
// 						if (VideoEngineBus.callbackMapHourOfDayEff !== undefined) {
// 							VideoEngineBus.callbackMapHourOfDayEff(<number>videoBusWorkerPayload.data);
// 						} else {
// 							console.error('VideoEngineBus > input: hour of day eff callback not set');
// 						}
// 						break;
// 					case VideoBusOutputCmd.MAP_LOAD_STATUS:
// 						videoBusOutputCmdMapLoadStatus = <VideoBusOutputCmdMapLoadStatus>videoBusWorkerPayload.data;
// 						if (VideoEngineBus.callbackMapLoadStatus !== undefined) {
// 							VideoEngineBus.callbackMapLoadStatus(videoBusOutputCmdMapLoadStatus.status);
// 						} else {
// 							console.error('VideoEngineBus > input: map load status callback not set');
// 						}
// 						break;
// 					case VideoBusOutputCmd.MAP_SAVE:
// 						videoBusOutputCmdMapSave = <VideoBusOutputCmdMapSave>videoBusWorkerPayload.data;
// 						if (VideoEngineBus.callbackMapSave !== undefined) {
// 							VideoEngineBus.callbackMapSave(videoBusOutputCmdMapSave.data, videoBusOutputCmdMapSave.name);
// 						} else {
// 							console.error('VideoEngineBus > input: map save callback not set');
// 						}
// 						break;
// 					case VideoBusOutputCmd.RUMBLE:
// 						videoBusOutputCmdRumble = <VideoBusOutputCmdRumble>videoBusWorkerPayload.data;
// 						if (VideoEngineBus.callbackRumble !== undefined) {
// 							VideoEngineBus.callbackRumble(
// 								videoBusOutputCmdRumble.durationInMS,
// 								videoBusOutputCmdRumble.enable,
// 								videoBusOutputCmdRumble.intensity,
// 							);
// 						} else {
// 							console.error('VideoEngineBus > input: map save callback not set');
// 						}
// 						break;
// 					case VideoBusOutputCmd.STATUS_INITIALIZED:
// 						videoBusWorkerStatusInitialized = <VideoBusWorkerStatusInitialized>videoBusWorkerPayload.data;
// 						VideoEngineBus.callbackStatusInitialized(Math.round(videoBusWorkerStatusInitialized.durationInMs * 1000) / 1000);

// 						setTimeout(() => {
// 							// This possibly resolves screen size issues on first boot
// 							// Canvas too small, but fixed on resize (rare, issue with browser)
// 							VideoEngineBus.resized(false, true);
// 						});
// 						break;
// 				}

// 				if (Object.keys(bufferIds).length) {
// 					VideoEngineBus.outputAudioBufferId(bufferIds);
// 				}
// 			}
// 		};
// 	}

// 	private static outputAudioBufferId(bufferIds: { [key: number]: number | undefined }): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.AUDIO_BUFFER_IDS,
// 			data: {
// 				bufferIds: bufferIds,
// 			},
// 		});
// 	}

// 	public static outputGameModeEdit(edit: VideoBusInputCmdGameModeEdit): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_MODE_EDIT,
// 			data: edit,
// 		});
// 	}

// 	public static outputGameModeEditApply(apply: VideoBusInputCmdGameModeEditApply): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_MODE_EDIT_APPLY,
// 			data: apply,
// 		});
// 	}

// 	public static outputGameModeEditApplyGroup(group: boolean): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_MODE_EDIT_APPLY_GROUP,
// 			data: group,
// 		});
// 	}

// 	public static outputGameModeEditDraw(apply: VideoBusInputCmdGameModeEditDraw): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_MODE_EDIT_DRAW,
// 			data: apply,
// 		});
// 	}

// 	public static outputGameModeEditRedo(): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_MODE_EDIT_REDO,
// 			data: null,
// 		});
// 	}

// 	public static outputGameModeEditSettings(mapConfig: MapConfig): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_MODE_EDIT_SETTINGS,
// 			data: mapConfig,
// 		});
// 	}

// 	public static outputGameModeEditTimeForced(enable: boolean): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_MODE_EDIT_TIME_FORCED,
// 			data: enable,
// 		});
// 	}

// 	public static outputGameModeEditUndo(): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_MODE_EDIT_UNDO,
// 			data: null,
// 		});
// 	}

// 	public static outputGameModePlay(play: VideoBusInputCmdGameModePlay): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_MODE_PLAY,
// 			data: play,
// 		});
// 	}

// 	public static outputGamePause(pause: VideoBusInputCmdGamePause): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_PAUSE,
// 			data: pause,
// 		});
// 	}

// 	public static outputGameSave(save: VideoBusInputCmdGameSave): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_SAVE,
// 			data: save,
// 		});
// 	}

// 	public static outputGameStart(start: VideoBusInputCmdGameStart): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_START,
// 			data: start,
// 		});
// 	}

// 	public static outputGameUnpause(unpause: VideoBusInputCmdGameUnpause): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.GAME_UNPAUSE,
// 			data: unpause,
// 		});
// 	}

// 	public static outputKey(keyAction: KeyAction): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.KEY,
// 			data: keyAction,
// 		});
// 	}

// 	public static outputMapLoad(file: string): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.MAP_LOAD,
// 			data: {
// 				data: file,
// 			},
// 		});
// 	}

// 	/**
// 	 * @param id undefined indicates a new map
// 	 */
// 	public static outputMapLoadById(id: string | undefined): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.MAP_LOAD_BY_ID,
// 			data: {
// 				id: id,
// 			},
// 		});
// 	}

// 	public static outputMouse(action: MouseAction): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.MOUSE,
// 			data: action,
// 		});
// 	}

// 	public static outputSettings(settings: VideoBusInputCmdSettings): void {
// 		VideoEngineBus.resolution = settings.resolution;
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.SETTINGS,
// 			data: settings,
// 		});

// 		setTimeout(() => {
// 			VideoEngineBus.resized(false, true);
// 		});
// 	}

// 	public static outputTouch(action: TouchAction): void {
// 		VideoEngineBus.worker.postMessage({
// 			cmd: VideoBusInputCmd.TOUCH,
// 			data: action,
// 		});
// 	}

// 	public static resized(disablePost?: boolean, force?: boolean): VideoBusInputCmdResize {
// 		let data: VideoBusInputCmdResize,
// 			devicePixelRatio: number = Math.round(window.devicePixelRatio * 1000) / 1000,
// 			devicePixelRatioEff: number = Math.round((1 / window.devicePixelRatio) * 1000) / 1000,
// 			domRect: DOMRect = VideoEngineBus.streams.getBoundingClientRect(),
// 			height: number,
// 			scaler: number,
// 			width: null | number = VideoEngineBus.resolution;

// 		switch (width) {
// 			case 128:
// 				height = 72;
// 				break;
// 			case 256:
// 				height = 144;
// 				break;
// 			case 384:
// 				height = 216;
// 				break;
// 			case 512:
// 				height = 288;
// 				break;
// 			case 640: // 360p
// 				height = 360;
// 				break;
// 			case 1280: // 720p
// 				height = 720;
// 				break;
// 			case 1920: // 1080p
// 				height = 1080;
// 				break;
// 			default: // native
// 				height = domRect.height;
// 				width = domRect.width;
// 				break;
// 		}

// 		if (VideoEngineBus.resolution !== null) {
// 			scaler = Math.round(((devicePixelRatioEff * domRect.width) / width) * 1000) / 1000;
// 		} else {
// 			scaler = devicePixelRatioEff;
// 		}

// 		// Transform the canvas to the intended size
// 		for (let i in VideoEngineBus.canvases) {
// 			VideoEngineBus.canvases[i].style.transform = 'scale(' + scaler + ')';
// 		}

// 		// Transform the map interaction to the correct starting place
// 		VideoEngineBus.mapInteration.style.transform =
// 			'translate(' + -UtilEngine.renderOverflowP * scaler + 'px, ' + UtilEngine.renderOverflowP * scaler + 'px)';

// 		data = {
// 			devicePixelRatio: devicePixelRatio,
// 			force: force,
// 			height: Math.round(height),
// 			scaler: Math.round((domRect.width / width / devicePixelRatioEff) * 1000) / 1000,
// 			width: Math.round(width),
// 		};

// 		if (VideoEngineBus.complete && disablePost !== true) {
// 			VideoEngineBus.worker.postMessage({
// 				cmd: VideoBusInputCmd.RESIZE,
// 				data: data,
// 			});
// 		}

// 		return data;
// 	}

// 	public static setCallbackEditCameraUpdate(callbackEditCameraUpdate: (update: VideoBusOutputCmdEditCameraUpdate) => void): void {
// 		VideoEngineBus.callbackEditCameraUpdate = callbackEditCameraUpdate;
// 	}

// 	public static setCallbackEditComplete(callbackEditComplete: () => void): void {
// 		VideoEngineBus.callbackEditComplete = callbackEditComplete;
// 	}

// 	public static setCallbackFPS(callbackFPS: (fps: number) => void): void {
// 		VideoEngineBus.callbackFPS = callbackFPS;
// 	}

// 	public static setCallbackMapAsset(callbackMapAsset: (mapActive: MapActive | undefined) => void): void {
// 		VideoEngineBus.callbackMapAsset = callbackMapAsset;
// 	}

// 	public static setCallbackMapHourOfDayEff(callbackMapHourOfDayEff: (hourOfDayEff: number) => void): void {
// 		VideoEngineBus.callbackMapHourOfDayEff = callbackMapHourOfDayEff;
// 	}

// 	public static setCallbackMapLoadStatus(callbackMapLoadStatus: (status: boolean) => void): void {
// 		VideoEngineBus.callbackMapLoadStatus = callbackMapLoadStatus;
// 	}

// 	public static setCallbackMapSave(callbackMapSave: (data: string, name: string) => void): void {
// 		VideoEngineBus.callbackMapSave = callbackMapSave;
// 	}

// 	public static setCallbackRumble(callbackRumble: (durationInMs: number, enable: boolean, intensity: number) => void): void {
// 		VideoEngineBus.callbackRumble = callbackRumble;
// 	}

// 	public static setCallbackStatusInitialized(callbackStatusInitialized: (durationInMs: number) => void): void {
// 		VideoEngineBus.callbackStatusInitialized = callbackStatusInitialized;
// 	}

// 	public static isGoComplete(): boolean {
// 		return VideoEngineBus.complete;
// 	}
// }
