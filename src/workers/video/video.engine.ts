import {
	VideoBusInputCmd,
	VideoBusInputDataInit,
	VideoBusInputDataResize,
	VideoBusInputDataSettings,
	VideoBusInputPayload,
	VideoBusOutputCmd,
	VideoBusOutputPayload,
} from './video.model';
import { CalcBusOutputDataPositions, masks, Stat, Stats, xyWidthBits } from '../calc/calc.model';

/**
 * @author tknight-dev
 */

self.onmessage = (event: MessageEvent) => {
	const videoBusInputPayload: VideoBusInputPayload = event.data;

	switch (videoBusInputPayload.cmd) {
		case VideoBusInputCmd.DATA:
			VideoWorkerEngine.inputData(<CalcBusOutputDataPositions>videoBusInputPayload.data);
			break;
		case VideoBusInputCmd.INIT:
			VideoWorkerEngine.initialize(self, <VideoBusInputDataInit>videoBusInputPayload.data);
			break;
		case VideoBusInputCmd.RESET:
			VideoWorkerEngine.inputReset();
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
	private static ctxWidth: number;
	private static data: CalcBusOutputDataPositions;
	private static dataNew: boolean;
	private static drawDeadCells: boolean;
	private static drawGrid: boolean;
	private static frameRequest: number;
	private static framesPerMillisecond: number;
	private static reset: boolean = true;
	private static resized: boolean;
	private static self: Window & typeof globalThis;
	private static settingsNew: boolean;
	private static stats: { [key: number]: Stat } = {};
	private static tableSizeX: 48 | 112 | 240 | 496 | 1008 | 2032 | 8176 | 16368 | 32752;

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

		// Stats
		VideoWorkerEngine.stats[Stats.CALC_TO_VIDEO_BUS_AVG] = new Stat();
		VideoWorkerEngine.stats[Stats.VIDEO_DRAW_AVG] = new Stat();

		// Engines
		VideoWorkerEngine.inputData({
			alive: new Uint32Array(),
			deadMode: true,
			deadOrNone: new Uint32Array(),
			timestamp: new Date().getTime(),
		});
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

	public static inputData(data: CalcBusOutputDataPositions): void {
		VideoWorkerEngine.data = data;
		VideoWorkerEngine.dataNew = true;
		VideoWorkerEngine.stats[Stats.CALC_TO_VIDEO_BUS_AVG].add(new Date().getTime() - data.timestamp);
	}

	public static inputReset(): void {
		VideoWorkerEngine.reset = true;
	}

	public static inputResize(data: VideoBusInputDataResize): void {
		let devicePixelRatio: number = data.devicePixelRatio,
			height: number = Math.floor(data.height * devicePixelRatio),
			width: number = Math.floor(data.width * devicePixelRatio);

		VideoWorkerEngine.ctxHeight = height;
		VideoWorkerEngine.ctxWidth = width;
		VideoWorkerEngine.resized = true;
	}

	public static inputSettings(data: VideoBusInputDataSettings): void {
		VideoWorkerEngine.drawDeadCells = data.drawDeadCells;
		VideoWorkerEngine.drawGrid = data.drawGrid;
		VideoWorkerEngine.framesPerMillisecond = (1000 / data.fps) | 0;
		VideoWorkerEngine.settingsNew = true;
		VideoWorkerEngine.tableSizeX = data.tableSizeX;
	}

	private static post(VideoBusWorkerPayloads: VideoBusOutputPayload[]): void {
		VideoWorkerEngine.self.postMessage({
			payloads: VideoBusWorkerPayloads,
		});
	}

	private static render(_: number): void {}

	/**
	 * Performance Tweaks: Failure Logs
	 */
	private static renderBinder(): boolean {
		let cache: boolean,
			cacheCanvasCellAlive: OffscreenCanvas = new OffscreenCanvas(1, 1),
			cacheCanvasCellAliveCtx: OffscreenCanvasRenderingContext2D,
			cacheCanvasCellDead: OffscreenCanvas = new OffscreenCanvas(1, 1),
			cacheCanvasCellDeadCtx: OffscreenCanvasRenderingContext2D,
			cacheCanvasGridHorizontal: OffscreenCanvas = new OffscreenCanvas(1, 1),
			cacheCanvasGridHorizontalCtx: OffscreenCanvasRenderingContext2D,
			cacheCanvasGrids: OffscreenCanvas = new OffscreenCanvas(1, 1),
			cacheCanvasGridsCtx: OffscreenCanvasRenderingContext2D,
			cacheCanvasGridVertical: OffscreenCanvas = new OffscreenCanvas(1, 1),
			cacheCanvasGridVerticalCtx: OffscreenCanvasRenderingContext2D,
			canvasOffscreen: OffscreenCanvas = VideoWorkerEngine.canvasOffscreen,
			canvasOffscreenContext: OffscreenCanvasRenderingContext2D = VideoWorkerEngine.canvasOffscreenContext,
			contextOptionsNoAlpha = {
				alpha: false,
				antialias: false,
				depth: true,
				desynchronized: true,
				powerPreference: 'high-performance',
				preserveDrawingBuffer: true,
			},
			data: CalcBusOutputDataPositions,
			drawDeadCells: boolean,
			drawGrid: boolean,
			frameCount: number = 0,
			frameTimestampDelta: number = 0,
			frameTimestampFPSThen: number = 0,
			frameTimestampThen: number = 0,
			pxCellSize: number,
			pxHeight: number,
			pxWidth: number,
			statDrawAvg: Stat = VideoWorkerEngine.stats[Stats.VIDEO_DRAW_AVG],
			tableSizeX: number,
			x: number,
			xy: number,
			y: number;

		const { yMask } = masks;

		cacheCanvasCellAliveCtx = <OffscreenCanvasRenderingContext2D>cacheCanvasCellAlive.getContext('2d', contextOptionsNoAlpha);
		cacheCanvasCellAliveCtx.imageSmoothingEnabled = false;
		cacheCanvasCellAliveCtx.shadowBlur = 0;

		cacheCanvasCellDeadCtx = <OffscreenCanvasRenderingContext2D>cacheCanvasCellDead.getContext('2d', contextOptionsNoAlpha);
		cacheCanvasCellDeadCtx.imageSmoothingEnabled = false;
		cacheCanvasCellDeadCtx.shadowBlur = 0;

		cacheCanvasGridHorizontalCtx = <OffscreenCanvasRenderingContext2D>cacheCanvasGridHorizontal.getContext('2d', contextOptionsNoAlpha);
		cacheCanvasGridHorizontalCtx.imageSmoothingEnabled = false;
		cacheCanvasGridHorizontalCtx.shadowBlur = 0;

		cacheCanvasGridsCtx = <OffscreenCanvasRenderingContext2D>cacheCanvasGrids.getContext('2d', {
			...contextOptionsNoAlpha,
			alpha: true,
		});
		cacheCanvasGridsCtx.imageSmoothingEnabled = false;
		cacheCanvasGridsCtx.shadowBlur = 0;

		cacheCanvasGridVerticalCtx = <OffscreenCanvasRenderingContext2D>cacheCanvasGridVertical.getContext('2d', contextOptionsNoAlpha);
		cacheCanvasGridVerticalCtx.imageSmoothingEnabled = false;
		cacheCanvasGridVerticalCtx.shadowBlur = 0;

		const render = (timestampNow: number) => {
			timestampNow |= 0;

			// Start the request for the next frame
			VideoWorkerEngine.frameRequest = requestAnimationFrame(render);
			frameTimestampDelta = timestampNow - frameTimestampThen;

			if (VideoWorkerEngine.reset || tableSizeX !== VideoWorkerEngine.tableSizeX) {
				VideoWorkerEngine.dataNew = true;

				cache = false;
				frameTimestampDelta = VideoWorkerEngine.framesPerMillisecond + 1;
			}

			if (VideoWorkerEngine.resized || VideoWorkerEngine.settingsNew) {
				VideoWorkerEngine.resized = false;
				VideoWorkerEngine.settingsNew = false;

				cache = false;
				drawDeadCells = VideoWorkerEngine.drawDeadCells;
				drawGrid = VideoWorkerEngine.drawGrid;
				pxHeight = VideoWorkerEngine.ctxHeight;
				pxWidth = VideoWorkerEngine.ctxWidth;
				tableSizeX = VideoWorkerEngine.tableSizeX;

				pxCellSize = Math.round((pxWidth / tableSizeX) * 1000) / 1000;
				if (drawGrid && pxWidth / tableSizeX < 3) {
					drawGrid = false;
				}

				// console.log('pxCellSize', pxCellSize);
				// console.log('pxHeight', pxHeight);
				// console.log('pxWidth', pxWidth);

				canvasOffscreen.height = pxHeight;
				canvasOffscreen.width = pxWidth;

				cacheCanvasCellAlive.height = pxCellSize;
				cacheCanvasCellAlive.width = pxCellSize;
				cacheCanvasCellAliveCtx.fillStyle = 'rgb(0,255,0)';
				cacheCanvasCellAliveCtx.fillRect(0, 0, pxCellSize, pxCellSize);

				cacheCanvasCellDead.height = pxCellSize;
				cacheCanvasCellDead.width = pxCellSize;
				cacheCanvasCellDeadCtx.fillStyle = 'rgb(0,64,0)';
				cacheCanvasCellDeadCtx.fillRect(0, 0, pxCellSize, pxCellSize);

				if (drawGrid) {
					cacheCanvasGridHorizontal.height = 1;
					cacheCanvasGridHorizontal.width = pxWidth;
					cacheCanvasGridHorizontalCtx.fillStyle = 'rgba(255,255,255,0.25)';
					cacheCanvasGridHorizontalCtx.fillRect(0, 0, pxWidth, 1);

					cacheCanvasGridVertical.height = pxHeight;
					cacheCanvasGridVertical.width = 1;
					cacheCanvasGridVerticalCtx.fillStyle = cacheCanvasGridHorizontalCtx.fillStyle;
					cacheCanvasGridVerticalCtx.fillRect(0, 0, 1, pxHeight);

					cacheCanvasGrids.height = pxHeight;
					cacheCanvasGrids.width = pxWidth;

					for (y = 0; y < pxHeight; y += pxCellSize) {
						cacheCanvasGridsCtx.drawImage(cacheCanvasGridHorizontal, 0, y);
					}

					// Grid: Vertical
					for (x = 0; x < pxWidth; x += pxCellSize) {
						cacheCanvasGridsCtx.drawImage(cacheCanvasGridVertical, x, 0);
					}
				}
			}

			/**
			 * Render data at frames per ms rate
			 */
			if (frameTimestampDelta > VideoWorkerEngine.framesPerMillisecond) {
				frameTimestampThen = timestampNow - (frameTimestampDelta % VideoWorkerEngine.framesPerMillisecond);
				frameCount++;

				// Process Data
				if (!cache || VideoWorkerEngine.dataNew) {
					VideoWorkerEngine.dataNew = false;
					data = VideoWorkerEngine.data;

					// Draw
					if (data.alive.length + data.deadOrNone.length > 0) {
						statDrawAvg.watchStart();

						// Draw: Background
						if (drawDeadCells && !data.deadMode) {
							canvasOffscreenContext.fillStyle = 'rgb(0,64,0)';
							canvasOffscreenContext.fillRect(0, 0, pxWidth, pxHeight);
						} else {
							canvasOffscreenContext.clearRect(0, 0, pxWidth, pxHeight);
						}

						// Draw: Living Cells
						for (xy of data.alive) {
							x = (xy >> xyWidthBits) & yMask;
							y = xy & yMask;
							canvasOffscreenContext.drawImage(cacheCanvasCellAlive, x * pxCellSize, y * pxCellSize);
						}

						// Clear/Draw: Dead Cells
						if (drawDeadCells) {
							if (data.deadMode) {
								// Draw dead cells
								for (xy of data.deadOrNone) {
									x = (xy >> xyWidthBits) & yMask;
									y = xy & yMask;
									canvasOffscreenContext.drawImage(cacheCanvasCellDead, x * pxCellSize, y * pxCellSize);
								}
							} else {
								// Clear non-dead cells
								for (xy of data.deadOrNone) {
									x = (xy >> xyWidthBits) & yMask;
									y = xy & yMask;
									canvasOffscreenContext.clearRect(x * pxCellSize, y * pxCellSize, pxCellSize, pxCellSize);
								}
							}
						}

						// Grid
						if (drawGrid) {
							canvasOffscreenContext.drawImage(cacheCanvasGrids, 0, 0);
						}

						cache = true;
						statDrawAvg.watchStop();

						if (VideoWorkerEngine.reset) {
							VideoWorkerEngine.reset = false;

							VideoWorkerEngine.post([
								{
									cmd: VideoBusOutputCmd.RESET_COMPLETE,
									data: undefined,
								},
							]);
						}
					}
				}
			}

			/**
			 * Send FPS to main thread every second
			 */
			if (timestampNow - frameTimestampFPSThen > 999) {
				VideoWorkerEngine.post([
					{
						cmd: VideoBusOutputCmd.STATS,
						data: {
							fps: frameCount,
							performance: VideoWorkerEngine.stats,
						},
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
