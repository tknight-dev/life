import {
	VideoBusInputCmd,
	VideoBusInputDataInit,
	VideoBusInputDataResize,
	VideoBusInputDataSettings,
	VideoBusInputPayload,
	VideoBusOutputCmd,
	VideoBusOutputPayload,
} from './video.model';

/**
 * @author tknight-dev
 */

self.onmessage = (event: MessageEvent) => {
	const videoBusInputPayload: VideoBusInputPayload = event.data;

	switch (videoBusInputPayload.cmd) {
		case VideoBusInputCmd.DATA:
			VideoWorkerEngine.inputData(<Uint32Array>videoBusInputPayload.data);
			break;
		case VideoBusInputCmd.INIT:
			VideoWorkerEngine.initialize(self, <VideoBusInputDataInit>videoBusInputPayload.data);
			break;
		case VideoBusInputCmd.RESIZE:
			VideoWorkerEngine.inputResize(<VideoBusInputDataResize>videoBusInputPayload.data);
			break;
		case VideoBusInputCmd.SETTINGS:
			VideoWorkerEngine.inputSettings(<VideoBusInputDataSettings>videoBusInputPayload.data);
			break;
	}
};

class VideoWorkerEngine {
	private static canvasOffscreen: OffscreenCanvas;
	private static canvasOffscreenContext: OffscreenCanvasRenderingContext2D;
	private static ctxHeight: number;
	private static ctxScaler: number;
	private static ctxWidth: number;
	private static data: Uint32Array;
	private static dataNew: boolean;
	private static devicePixelRatioEff: number;
	private static frameRequest: number;
	private static framesPerMillisecond: number;
	private static grid: boolean;
	private static resized: boolean;
	private static self: Window & typeof globalThis;
	private static settingsNew: boolean;
	private static tableSizeX: 48 | 112 | 240 | 496 | 1008 | 2032 | 8176 | 16368 | 32752;
	private static tableSizeY: number;

	public static async initialize(self: Window & typeof globalThis, data: VideoBusInputDataInit): Promise<void> {
		// Config
		VideoWorkerEngine.canvasOffscreen = data.canvasOffscreen;
		VideoWorkerEngine.canvasOffscreenContext = <OffscreenCanvasRenderingContext2D>data.canvasOffscreen.getContext('2d', {
			alpha: true,
			antialias: false,
			depth: true,
			desynchronized: true,
			powerPreference: 'high-performance',
			preserveDrawingBuffer: true,
		});
		VideoWorkerEngine.canvasOffscreenContext.imageSmoothingEnabled = false;
		VideoWorkerEngine.canvasOffscreenContext.shadowBlur = 0;
		VideoWorkerEngine.self = self;

		// Engines
		VideoWorkerEngine.inputData(data.life);
		VideoWorkerEngine.inputResize(data);
		VideoWorkerEngine.inputSettings(data);

		// Done
		if (VideoWorkerEngine.canvasOffscreenContext === null) {
			console.error('Engine > Video: failed acquire context');
			VideoWorkerEngine.post([
				{
					cmd: VideoBusOutputCmd.INIT_COMPLETE,
					data: false,
				},
			]);
		} else {
			let status: boolean = VideoWorkerEngine.renderBinder();
			VideoWorkerEngine.post([
				{
					cmd: VideoBusOutputCmd.INIT_COMPLETE,
					data: status,
				},
			]);

			if (status) {
				// Start rendering thread
				VideoWorkerEngine.frameRequest = requestAnimationFrame(VideoWorkerEngine.render);
			}
		}
	}

	public static inputData(data: Uint32Array): void {
		VideoWorkerEngine.data = data;
		VideoWorkerEngine.dataNew = true;
	}

	public static inputResize(data: VideoBusInputDataResize): void {
		let devicePixelRatio: number = data.devicePixelRatio,
			height: number = Math.floor(data.height * devicePixelRatio),
			width: number = Math.floor(data.width * devicePixelRatio);

		VideoWorkerEngine.ctxHeight = height;
		VideoWorkerEngine.ctxScaler = data.scaler;
		VideoWorkerEngine.ctxWidth = width;
		VideoWorkerEngine.devicePixelRatioEff = Math.round((1 / devicePixelRatio) * 1000) / 1000;
		VideoWorkerEngine.resized = true;

		VideoWorkerEngine.canvasOffscreen.height = height;
		VideoWorkerEngine.canvasOffscreen.width = width;
	}

	public static inputSettings(data: VideoBusInputDataSettings): void {
		if (data.fps === 1) {
			// Unlimited*
			VideoWorkerEngine.framesPerMillisecond = 1;
		} else {
			VideoWorkerEngine.framesPerMillisecond = (1000 / data.fps) | 0;
		}
		VideoWorkerEngine.grid = data.grid;
		VideoWorkerEngine.settingsNew = true;
		VideoWorkerEngine.tableSizeX = data.tableSizeX;
		VideoWorkerEngine.tableSizeY = (data.tableSizeX * 9) / 16;
	}

	private static post(VideoBusWorkerPayloads: VideoBusOutputPayload[]): void {
		VideoWorkerEngine.self.postMessage({
			payloads: VideoBusWorkerPayloads,
		});
	}

	private static render(timestampNow: number): void {}

	private static renderBinder(): boolean {
		let cacheCanvasCell: OffscreenCanvas,
			cacheCanvasCellAlive: OffscreenCanvas = new OffscreenCanvas(1, 1),
			cacheCanvasCellAliveCtx: OffscreenCanvasRenderingContext2D,
			cacheCanvasCellDead: OffscreenCanvas = new OffscreenCanvas(1, 1),
			cacheCanvasCellDeadCtx: OffscreenCanvasRenderingContext2D,
			cacheCanvasGridHorizontal: OffscreenCanvas = new OffscreenCanvas(1, 1),
			cacheCanvasGridHorizontalCtx: OffscreenCanvasRenderingContext2D,
			cacheCanvasGridVertical: OffscreenCanvas = new OffscreenCanvas(1, 1),
			cacheCanvasGridVerticalCtx: OffscreenCanvasRenderingContext2D,
			canvasOffscreenContext: OffscreenCanvasRenderingContext2D = VideoWorkerEngine.canvasOffscreenContext,
			contextOptionsNoAlpha = {
				alpha: false,
				antialias: false,
				depth: true,
				desynchronized: true,
				powerPreference: 'high-performance',
				preserveDrawingBuffer: true,
			},
			data: Uint32Array,
			grid: boolean,
			frameCount: number = 0,
			frameTimestampDelta: number = 0,
			frameTimestampFPSThen: number = 0,
			frameTimestampThen: number = 0,
			pxCellSize: number,
			pxHeight: number,
			pxWidth: number,
			resized: boolean,
			tableSizeX: number,
			tableSizeY: number,
			x: number,
			xy: number,
			xyMaskAlive: number = 0x40000000, // 0x40000000 is 1 << 30 (alive)
			y: number;

		cacheCanvasCellAliveCtx = <OffscreenCanvasRenderingContext2D>cacheCanvasCellAlive.getContext('2d', contextOptionsNoAlpha);
		cacheCanvasCellAliveCtx.imageSmoothingEnabled = false;
		cacheCanvasCellAliveCtx.shadowBlur = 0;

		cacheCanvasCellDeadCtx = <OffscreenCanvasRenderingContext2D>cacheCanvasCellDead.getContext('2d', contextOptionsNoAlpha);
		cacheCanvasCellDeadCtx.imageSmoothingEnabled = false;
		cacheCanvasCellDeadCtx.shadowBlur = 0;

		cacheCanvasGridHorizontalCtx = <OffscreenCanvasRenderingContext2D>cacheCanvasGridHorizontal.getContext('2d', contextOptionsNoAlpha);
		cacheCanvasGridHorizontalCtx.imageSmoothingEnabled = false;
		cacheCanvasGridHorizontalCtx.shadowBlur = 0;

		cacheCanvasGridVerticalCtx = <OffscreenCanvasRenderingContext2D>cacheCanvasGridVertical.getContext('2d', contextOptionsNoAlpha);
		cacheCanvasGridVerticalCtx.imageSmoothingEnabled = false;
		cacheCanvasGridVerticalCtx.shadowBlur = 0;

		const render = (timestampNow: number) => {
			timestampNow |= 0;

			// Start the request for the next frame
			VideoWorkerEngine.frameRequest = requestAnimationFrame(render);
			frameTimestampDelta = timestampNow - frameTimestampThen;

			if (VideoWorkerEngine.dataNew) {
				VideoWorkerEngine.dataNew = false;

				data = VideoWorkerEngine.data;
			}

			if (VideoWorkerEngine.resized || VideoWorkerEngine.settingsNew) {
				VideoWorkerEngine.resized = false;
				VideoWorkerEngine.settingsNew = false;

				grid = VideoWorkerEngine.grid;
				pxHeight = VideoWorkerEngine.ctxHeight;
				pxWidth = VideoWorkerEngine.ctxWidth;
				tableSizeX = VideoWorkerEngine.tableSizeX;
				tableSizeY = VideoWorkerEngine.tableSizeY;

				pxCellSize = Math.max(1, Math.round(pxWidth / tableSizeX));

				cacheCanvasCellAlive.height = pxCellSize;
				cacheCanvasCellAlive.width = pxCellSize;
				cacheCanvasCellAliveCtx.fillStyle = 'green';
				cacheCanvasCellAliveCtx.fillRect(0, 0, pxCellSize, pxCellSize);

				cacheCanvasCellDead.height = pxCellSize;
				cacheCanvasCellDead.width = pxCellSize;
				cacheCanvasCellDeadCtx.fillStyle = 'red';
				cacheCanvasCellDeadCtx.fillRect(0, 0, pxCellSize, pxCellSize);

				cacheCanvasGridHorizontal.height = 1;
				cacheCanvasGridHorizontal.width = pxWidth;
				cacheCanvasGridHorizontalCtx.fillStyle = 'rgba(255,255,255,0.25)';
				cacheCanvasGridHorizontalCtx.fillRect(0, 0, pxWidth, 1);

				cacheCanvasGridVertical.height = pxHeight;
				cacheCanvasGridVertical.width = 1;
				cacheCanvasGridVerticalCtx.fillStyle = cacheCanvasGridHorizontalCtx.fillStyle;
				cacheCanvasGridVerticalCtx.fillRect(0, 0, 1, pxHeight);
			}

			/**
			 * Render data at frames per ms rate
			 */
			if (frameTimestampDelta > VideoWorkerEngine.framesPerMillisecond) {
				frameTimestampThen = timestampNow - (frameTimestampDelta % VideoWorkerEngine.framesPerMillisecond);
				frameCount++;

				// Draw
				canvasOffscreenContext.clearRect(0, 0, pxWidth, pxHeight);

				// Cells
				for (xy of data) {
					x = (xy >> 15) & 0x7fff;
					y = xy & 0x7fff;

					cacheCanvasCell = (xy & xyMaskAlive) !== 0 ? cacheCanvasCellAlive : cacheCanvasCellDead;
					canvasOffscreenContext.drawImage(cacheCanvasCell, x * pxCellSize, y * pxCellSize);
				}

				// Grid: Horizontal
				for (y = 0; y < pxHeight; y += pxCellSize) {
					canvasOffscreenContext.drawImage(cacheCanvasGridHorizontal, 0, y);
				}

				// Grid: Vertical
				for (x = 0; x < pxWidth; x += pxCellSize) {
					canvasOffscreenContext.drawImage(cacheCanvasGridVertical, x, 0);
				}
			}

			/**
			 * Send FPS to main thread every second
			 */
			if (timestampNow - frameTimestampFPSThen > 999) {
				VideoWorkerEngine.post([
					{
						cmd: VideoBusOutputCmd.FPS,
						data: frameCount,
					},
				]);
				frameCount = 0;
				frameTimestampFPSThen = timestampNow;
			}
		};
		VideoWorkerEngine.render = render;
		return true;
	}
}
