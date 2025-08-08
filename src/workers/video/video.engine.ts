import {
	VideoBusInputCmd,
	VideoBusInputDataCamera,
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

const { yMask } = masks;

self.onmessage = (event: MessageEvent) => {
	const videoBusInputPayload: VideoBusInputPayload = event.data;

	switch (videoBusInputPayload.cmd) {
		case VideoBusInputCmd.CAMERA:
			VideoWorkerEngine.inputCamera(<VideoBusInputDataCamera>videoBusInputPayload.data);
			break;
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
	private static camera: VideoBusInputDataCamera;
	private static cameraUpdated: boolean;
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
	private static tableSizeY: number;

	public static async initialize(self: Window & typeof globalThis, data: VideoBusInputDataInit): Promise<void> {
		// Config
		VideoWorkerEngine.camera = {
			relX: 0,
			relY: 0,
			zoom: 1,
		};
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

	public static inputCamera(data: VideoBusInputDataCamera): void {
		VideoWorkerEngine.camera = data;
		VideoWorkerEngine.cameraUpdated = true;
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
		VideoWorkerEngine.tableSizeY = (data.tableSizeX * 9) / 16;
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
			cameraRelX: number = VideoWorkerEngine.camera.relX,
			cameraRelY: number = VideoWorkerEngine.camera.relY,
			cameraZoom: number = VideoWorkerEngine.camera.zoom,
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
			tableSizeY: number,
			viewPortMode: boolean,
			viewPortHeightC: number,
			viewPortHeightPx: number,
			viewPortHeightStartC: number,
			viewPortHeightStartPx: number,
			viewPortHeightStopC: number,
			viewPortHeightStopPx: number,
			viewPortWidthC: number,
			viewPortWidthPx: number,
			viewPortWidthStartC: number,
			viewPortWidthStartPx: number,
			viewPortWidthStopC: number,
			viewPortWidthStopPx: number,
			x: number,
			xy: number,
			y: number;

		/*
		 * Canvas: Init
		 */
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

		/*
		 * Functions
		 */
		const scale = (v: number, a: number, b: number, y: number, z: number) => {
			return ((v - a) * (z - y)) / (b - a) + y;
		};
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

			if (VideoWorkerEngine.cameraUpdated || VideoWorkerEngine.resized || VideoWorkerEngine.settingsNew) {
				VideoWorkerEngine.cameraUpdated = false;
				VideoWorkerEngine.settingsNew = false;

				// Cache: variables
				cache = false;
				cameraRelX = VideoWorkerEngine.camera.relX;
				cameraRelY = VideoWorkerEngine.camera.relY;
				cameraZoom = VideoWorkerEngine.camera.zoom;
				drawDeadCells = VideoWorkerEngine.drawDeadCells;
				drawGrid = VideoWorkerEngine.drawGrid;
				pxHeight = VideoWorkerEngine.ctxHeight;
				pxWidth = VideoWorkerEngine.ctxWidth;
				tableSizeX = VideoWorkerEngine.tableSizeX;
				tableSizeY = VideoWorkerEngine.tableSizeY;

				// Grid: auto enable/disable
				if (drawGrid && pxWidth / tableSizeX < 3) {
					drawGrid = false;
				}

				// Canvas: Resize
				if (VideoWorkerEngine.resized) {
					canvasOffscreen.height = pxHeight;
					canvasOffscreen.width = pxWidth;

					VideoWorkerEngine.resized = false;
				}

				// Calc: pixel size
				pxCellSize = Math.round((pxWidth / tableSizeX) * 1000) / 1000;
				if (cameraZoom !== 1) {
					pxCellSize *= scale(cameraZoom, 1, 100, 1, scale(tableSizeX, 48, 2023, 2, 85));

					// Viewport: Calc
					viewPortMode = true;

					viewPortHeightC = Math.round((pxHeight / pxCellSize) * 1000) / 1000;
					viewPortHeightPx = pxHeight;
					viewPortHeightStartC = Math.max(0, Math.round((cameraRelY * tableSizeY - viewPortHeightC / 2) * 1000) / 1000);
					viewPortHeightStartPx = Math.round(viewPortHeightStartC * pxCellSize * 1000) / 1000;
					viewPortHeightStopC = Math.round((viewPortHeightStartC + viewPortHeightC) * 1000) / 1000;
					viewPortHeightStopPx = Math.round(viewPortHeightStopC * pxCellSize * 1000) / 1000;

					viewPortWidthC = Math.round((pxWidth / pxCellSize) * 1000) / 1000;
					viewPortWidthPx = pxWidth;
					viewPortWidthStartC = Math.max(0, Math.round((cameraRelX * tableSizeX - viewPortWidthC / 2) * 1000) / 1000);
					viewPortWidthStartPx = Math.round(viewPortWidthStartC * pxCellSize * 1000) / 1000;
					viewPortWidthStopC = Math.round((viewPortWidthStartC + viewPortWidthC) * 1000) / 1000;
					viewPortWidthStopPx = Math.round(viewPortWidthStopC * pxCellSize * 1000) / 1000;
				} else {
					viewPortMode = false;

					// Viewport: Restore
					viewPortHeightC = tableSizeY;
					viewPortHeightPx = pxHeight;
					viewPortHeightStartC = 0;
					viewPortHeightStartPx = 0;
					viewPortHeightStopC = viewPortHeightStartC + viewPortHeightC;
					viewPortHeightStopPx = viewPortHeightStartPx + viewPortHeightPx;

					viewPortWidthC = tableSizeX;
					viewPortWidthPx = pxWidth;
					viewPortWidthStartC = 0;
					viewPortWidthStartPx = 0;
					viewPortWidthStopC = viewPortWidthStartC + viewPortWidthC;
					viewPortWidthStopPx = viewPortWidthStartPx + viewPortWidthPx;
				}

				// console.log(
				// 	'C',
				// 	viewPortWidthStartC,
				// 	viewPortWidthStopC,
				// 	viewPortWidthC,
				// 	'x',
				// 	viewPortHeightStartC,
				// 	viewPortHeightStopC,
				// 	viewPortHeightC,
				// );

				// console.log(
				// 	'Px',
				// 	viewPortWidthStartPx,
				// 	viewPortWidthStopPx,
				// 	viewPortWidthPx,
				// 	'x',
				// 	viewPortHeightStartPx,
				// 	viewPortHeightStopPx,
				// 	viewPortHeightPx,
				// );

				// Cache: Cells
				cacheCanvasCellAlive.height = pxCellSize;
				cacheCanvasCellAlive.width = pxCellSize;
				cacheCanvasCellAliveCtx.fillStyle = 'rgb(0,255,0)';
				cacheCanvasCellAliveCtx.fillRect(0, 0, pxCellSize, pxCellSize);

				cacheCanvasCellDead.height = pxCellSize;
				cacheCanvasCellDead.width = pxCellSize;
				cacheCanvasCellDeadCtx.fillStyle = 'rgb(0,64,0)';
				cacheCanvasCellDeadCtx.fillRect(0, 0, pxCellSize, pxCellSize);

				// Cache: Grid
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

					// Grid: Horizontal
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
					VideoWorkerEngine.cameraUpdated = false;
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

						if (viewPortMode) {
							// Draw: Living Cells
							for (xy of data.alive) {
								x = (xy >> xyWidthBits) & yMask;
								y = xy & yMask;

								if (
									x > viewPortWidthStartC - 1 &&
									x < viewPortWidthStopC + 1 &&
									y > viewPortHeightStartC - 1 &&
									y < viewPortHeightStopC + 1
								) {
									canvasOffscreenContext.drawImage(
										cacheCanvasCellAlive,
										(x - viewPortWidthStartC) * pxCellSize,
										(y - viewPortHeightStartC) * pxCellSize,
									);
								}
							}

							// Draw: Grid
							// drawGrid && canvasOffscreenContext.drawImage(cacheCanvasGrids, viewPortWidthStartPx, viewPortHeightStartPx);
						} else {
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

							// Draw: Grid
							drawGrid && canvasOffscreenContext.drawImage(cacheCanvasGrids, 0, 0);
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
