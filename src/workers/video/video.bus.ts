import {
	VideoBusInputCmd,
	VideoBusInputDataInit,
	VideoBusInputDataResize,
	VideoBusInputDataSettings,
	VideoBusInputPayload,
	VideoBusOutputCmd,
	VideoBusOutputDataStats,
	VideoBusOutputPayload,
} from './video.model';

/**
 * @author tknight-dev
 */

export class VideoBusEngine {
	private static callbackInitComplete: (status: boolean) => void;
	private static callbackResetComplete: () => void;
	private static callbackStats: (data: VideoBusOutputDataStats) => void;
	private static canvas: HTMLCanvasElement;
	private static canvasOffscreen: OffscreenCanvas;
	private static complete: boolean;
	private static game: HTMLElement;
	private static resolution: null | 256 | 384 | 512 | 640 | 1280 | 1920;
	private static tableSizeX: 48 | 112 | 240 | 496 | 1008 | 2032 | 8176 | 16368 | 32752;
	private static worker: Worker;

	/**
	 * Start the video streams in another thread
	 */
	public static initialize(
		canvas: HTMLCanvasElement,
		game: HTMLElement,
		life: Uint32Array,
		settings: VideoBusInputDataSettings,
		callback: (status: boolean) => void,
	): void {
		VideoBusEngine.callbackInitComplete = callback;
		VideoBusEngine.canvas = canvas;
		VideoBusEngine.canvasOffscreen = canvas.transferControlToOffscreen();
		VideoBusEngine.game = game;
		VideoBusEngine.resolution = settings.resolution;
		VideoBusEngine.tableSizeX = settings.tableSizeX;

		// Spawn Video thread
		if (window.Worker) {
			VideoBusEngine.worker = new Worker(new URL('./video.engine.mjs', import.meta.url), {
				name: 'VideoWorkerEngine',
				type: 'module',
			});

			// Setup listener
			VideoBusEngine.input();

			/*
			 * Initialization payload
			 */
			const videoBusInputDataInit: VideoBusInputDataInit = Object.assign(
				{
					canvasOffscreen: VideoBusEngine.canvasOffscreen,
					life: life,
				},
				VideoBusEngine.resized(true),
				settings,
			);
			const videoBusInputPayload: VideoBusInputPayload = {
				cmd: VideoBusInputCmd.INIT,
				data: videoBusInputDataInit,
			};
			VideoBusEngine.worker.postMessage(videoBusInputPayload, [VideoBusEngine.canvasOffscreen, life.buffer]);
			VideoBusEngine.complete = true;
		} else {
			alert('Web Workers are not supported by your browser');
		}
	}

	/*
	 * Commands from worker (typically audio effect triggers)
	 */
	private static input(): void {
		VideoBusEngine.worker.onmessage = async (event: MessageEvent) => {
			const payloads: VideoBusOutputPayload[] = event.data.payloads;

			for (let i = 0; i < payloads.length; i++) {
				switch (payloads[i].cmd) {
					case VideoBusOutputCmd.INIT_COMPLETE:
						VideoBusEngine.callbackInitComplete(<boolean>payloads[i].data);
						break;
					case VideoBusOutputCmd.RESET_COMPLETE:
						VideoBusEngine.callbackResetComplete();
						break;
					case VideoBusOutputCmd.STATS:
						VideoBusEngine.callbackStats(<VideoBusOutputDataStats>payloads[i].data);
						break;
				}
			}
		};
	}

	public static outputData(data: Uint32Array): void {
		VideoBusEngine.worker.postMessage(
			{
				cmd: VideoBusInputCmd.DATA,
				data: data,
			},
			[data.buffer],
		);
	}

	public static outputReset(data: Uint32Array): void {
		VideoBusEngine.worker.postMessage(
			{
				cmd: VideoBusInputCmd.RESET,
				data: data,
			},
			[data.buffer],
		);
	}

	public static outputSettings(data: VideoBusInputDataSettings): void {
		if (VideoBusEngine.resolution !== data.resolution || VideoBusEngine.tableSizeX !== data.tableSizeX) {
			VideoBusEngine.resolution = data.resolution;
			VideoBusEngine.tableSizeX = data.tableSizeX;
			VideoBusEngine.resized(false, true);
		}

		VideoBusEngine.worker.postMessage({
			cmd: VideoBusInputCmd.SETTINGS,
			data: data,
		});
	}

	public static resized(disablePost?: boolean, force?: boolean): VideoBusInputDataResize {
		let data: VideoBusInputDataResize,
			devicePixelRatio: number = Math.round(window.devicePixelRatio * 1000) / 1000,
			devicePixelRatioEff: number = Math.round((1 / window.devicePixelRatio) * 1000) / 1000,
			domRect: DOMRect = VideoBusEngine.game.getBoundingClientRect(),
			height: number,
			scaler: number,
			tableSizeX: number = VideoBusEngine.tableSizeX,
			width: null | number = VideoBusEngine.resolution;

		switch (width) {
			case 128:
				height = 72;
				break;
			case 256:
				height = 144;
				break;
			case 384:
				height = 216;
				break;
			case 512:
				height = 288;
				break;
			case 640: // 360p
				height = 360;
				break;
			case 1280: // 720p
				height = 720;
				break;
			case 1920: // 1080p
				height = 1080;
				break;
			default: // native
				height = domRect.height;
				width = domRect.width;
				break;
		}

		// Canvas cells must be atleast 1 px in size
		if (tableSizeX > width) {
			height = (tableSizeX * 9) / 16;
			width = tableSizeX;

			scaler = Math.round(((devicePixelRatioEff * domRect.width) / width) * 1000) / 1000;
		} else if (VideoBusEngine.resolution !== null) {
			scaler = Math.round(((devicePixelRatioEff * domRect.width) / width) * 1000) / 1000;
		} else {
			scaler = devicePixelRatioEff;
		}

		// Transform the canvas to the intended size
		VideoBusEngine.canvas.style.transform = 'scale(' + scaler + ')';

		data = {
			devicePixelRatio: devicePixelRatio,
			force: force,
			height: Math.round(height),
			width: Math.round(width),
		};

		if (VideoBusEngine.complete && disablePost !== true) {
			VideoBusEngine.worker.postMessage({
				cmd: VideoBusInputCmd.RESIZE,
				data: data,
			});
		}

		return data;
	}

	public static setCallbackResetComplete(callbackResetComplete: () => void): void {
		VideoBusEngine.callbackResetComplete = callbackResetComplete;
	}

	public static setCallbackStats(callbackStats: (data: VideoBusOutputDataStats) => void): void {
		VideoBusEngine.callbackStats = callbackStats;
	}
}
