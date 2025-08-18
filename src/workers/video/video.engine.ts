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
import { CalcBusOutputDataPositions, masks, scalePx, Stat, Stats, xyWidthBits } from '../calc/calc.model';
import { GamingCanvas } from '@tknight-dev/gaming-canvas';

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
	private static debug: boolean;
	private static drawDeadCells: boolean;
	private static drawGrid: boolean;
	private static frameRequest: number;
	private static framesPerMillisecond: number;
	private static reset: boolean = true;
	private static resized: boolean;
	private static self: Window & typeof globalThis;
	private static settingsNew: boolean;
	private static stats: { [key: number]: Stat } = {};
	private static tableSizeX: 32 | 80 | 160 | 320 | 640 | 960 | 1280 | 1920 | 2560;
	private static tableSizeY: number;

	public static async initialize(self: Window & typeof globalThis, data: VideoBusInputDataInit): Promise<void> {
		// Config
		VideoWorkerEngine.camera = {
			move: false,
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
				VideoWorkerEngine.cameraUpdated = true; // Force viewport callback on init
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
			height: number = (data.height * devicePixelRatio) | 0,
			width: number = (data.width * devicePixelRatio) | 0;

		VideoWorkerEngine.ctxHeight = height;
		VideoWorkerEngine.ctxWidth = width;
		VideoWorkerEngine.resized = true;
	}

	public static inputSettings(data: VideoBusInputDataSettings): void {
		VideoWorkerEngine.debug = data.debug;
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
			cameraPanX: number = 0,
			cameraPanXOriginal: number = 0,
			cameraPanY: number = 0,
			cameraPanYOriginal: number = 0,
			cameraCX: number = VideoWorkerEngine.tableSizeX / 2,
			cameraCY: number = VideoWorkerEngine.tableSizeY / 2,
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
			debug: boolean,
			drawDeadCells: boolean,
			drawGrid: boolean,
			frameCount: number = 0,
			frameTimestampDelta: number = 0,
			frameTimestampFPSThen: number = 0,
			frameTimestampThen: number = 0,
			pxCellSize: number,
			pxHeight: number,
			pxHeightEff: number,
			pxWidth: number,
			pxWidthEff: number,
			statDrawAvg: Stat = VideoWorkerEngine.stats[Stats.VIDEO_DRAW_AVG],
			tableSizeX: number,
			tableSizeY: number,
			viewPortMode: boolean,
			viewPortHeightC: number = VideoWorkerEngine.tableSizeY,
			viewPortHeightPx: number = VideoWorkerEngine.ctxHeight,
			viewPortHeightStartC: number = 0,
			viewPortHeightStartCEff: number,
			viewPortHeightStartPx: number = 0,
			viewPortHeightStopC: number = viewPortHeightStartC + viewPortHeightC,
			viewPortHeightStopCEff: number,
			// viewPortHeightStopPx: number = viewPortHeightStartPx + viewPortHeightPx,
			viewPortWidthC: number = VideoWorkerEngine.tableSizeX,
			viewPortWidthPx: number = VideoWorkerEngine.ctxWidth,
			viewPortWidthStartC: number = 0,
			viewPortWidthStartCEff: number,
			viewPortWidthStartPx: number = 0,
			viewPortWidthStopC: number = viewPortWidthStartC + viewPortWidthC,
			viewPortWidthStopCEff: number,
			// viewPortWidthStopPx: number = viewPortWidthStartPx + viewPortWidthPx,
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
				VideoWorkerEngine.settingsNew = false;

				// Cache: variables
				cache = false;
				cameraZoom = VideoWorkerEngine.camera.zoom;
				debug = VideoWorkerEngine.debug;
				drawDeadCells = VideoWorkerEngine.drawDeadCells;
				drawGrid = VideoWorkerEngine.drawGrid;
				pxHeight = VideoWorkerEngine.ctxHeight;
				pxWidth = VideoWorkerEngine.ctxWidth;
				tableSizeX = VideoWorkerEngine.tableSizeX;
				tableSizeY = VideoWorkerEngine.tableSizeY;

				// Canvas: Resize
				if (VideoWorkerEngine.resized) {
					canvasOffscreen.height = pxHeight;
					canvasOffscreen.width = pxWidth;

					VideoWorkerEngine.resized = false;
				}

				// Calc: pixel size
				pxCellSize = Math.max(1, Math.round((pxWidth / tableSizeX) * 1000) / 1000);
				if (cameraZoom !== 1) {
					pxCellSize *= scalePx(cameraZoom, tableSizeX);

					// Viewport: Calc
					viewPortMode = true;

					// Viewport: Sizing - Basic
					viewPortHeightC = Math.round((pxHeight / pxCellSize) * 1000) / 1000;
					viewPortHeightPx = pxHeight;
					viewPortWidthC = Math.round((pxWidth / pxCellSize) * 1000) / 1000;
					viewPortWidthPx = pxWidth;

					// Viewport: Camera pan
					if (VideoWorkerEngine.camera.move) {
						cameraPanX = (VideoWorkerEngine.camera.relX - cameraPanXOriginal) * viewPortWidthC;
						cameraPanY = (VideoWorkerEngine.camera.relY - cameraPanYOriginal) * viewPortHeightC;
					} else {
						cameraCX += cameraPanX;
						cameraCY += cameraPanY;
						cameraPanX = 0;
						cameraPanY = 0;
						cameraPanXOriginal = VideoWorkerEngine.camera.relX;
						cameraPanYOriginal = VideoWorkerEngine.camera.relY;
					}

					// Viewport: height + position bounded
					viewPortHeightStartC = Math.round((cameraCY + cameraPanY - viewPortHeightC / 2) * 1000) / 1000;
					if (viewPortHeightStartC < 0) {
						cameraCY = viewPortHeightC / 2;
						cameraPanY = 0;
						cameraPanYOriginal = VideoWorkerEngine.camera.relY;

						viewPortHeightStartC = 0;
						viewPortHeightStartPx = 0;

						viewPortHeightStopC = viewPortHeightC;
						// viewPortHeightStopPx = Math.round(viewPortHeightStopC * pxCellSize * 1000) / 1000;
					} else if (viewPortHeightStartC + viewPortHeightC > tableSizeY) {
						cameraCY = tableSizeY - viewPortHeightC / 2;
						cameraPanY = 0;
						cameraPanYOriginal = VideoWorkerEngine.camera.relY;

						viewPortHeightStopC = tableSizeY;
						// viewPortHeightStopPx = Math.round(viewPortHeightStopC * pxCellSize * 1000) / 1000;

						viewPortHeightStartC = viewPortHeightStopC - viewPortHeightC;
						viewPortHeightStartPx = Math.round(viewPortHeightStartC * pxCellSize * 1000) / 1000;
					} else {
						viewPortHeightStartPx = Math.round(viewPortHeightStartC * pxCellSize * 1000) / 1000;
						viewPortHeightStopC = Math.round((viewPortHeightStartC + viewPortHeightC) * 1000) / 1000;
						// viewPortHeightStopPx = Math.round(viewPortHeightStopC * pxCellSize * 1000) / 1000;
					}

					// Viewport: width + position bounded
					viewPortWidthStartC = Math.round((cameraCX + cameraPanX - viewPortWidthC / 2) * 1000) / 1000;
					if (viewPortWidthStartC < 0) {
						cameraCX = viewPortWidthC / 2;
						cameraPanX = 0;
						cameraPanXOriginal = VideoWorkerEngine.camera.relX;

						viewPortWidthStartC = 0;
						viewPortWidthStartPx = 0;

						viewPortWidthStopC = viewPortWidthC;
						// viewPortWidthStopPx = Math.round(viewPortWidthStopC * pxCellSize * 1000) / 1000;
					} else if (viewPortWidthStartC + viewPortWidthC > tableSizeX) {
						cameraCX = tableSizeX - viewPortWidthC / 2;
						cameraPanX = 0;
						cameraPanXOriginal = VideoWorkerEngine.camera.relX;

						viewPortWidthStopC = tableSizeX;
						// viewPortWidthStopPx = Math.round(viewPortWidthStopC * pxCellSize * 1000) / 1000;

						viewPortWidthStartC = viewPortWidthStopC - viewPortWidthC;
						viewPortWidthStartPx = Math.round(viewPortWidthStartC * pxCellSize * 1000) / 1000;
					} else {
						viewPortWidthStartPx = Math.round(viewPortWidthStartC * pxCellSize * 1000) / 1000;
						viewPortWidthStopC = Math.round((viewPortWidthStartC + viewPortWidthC) * 1000) / 1000;
						// viewPortWidthStopPx = Math.round(viewPortWidthStopC * pxCellSize * 1000) / 1000;
					}
				} else {
					viewPortMode = false;

					// Viewport: scale 1 to 1
					viewPortHeightC = tableSizeY;
					viewPortHeightPx = pxHeight;
					viewPortHeightStartC = 0;
					viewPortHeightStartPx = 0;
					viewPortHeightStopC = viewPortHeightStartC + viewPortHeightC;
					// viewPortHeightStopPx = viewPortHeightStartPx + viewPortHeightPx;

					viewPortWidthC = tableSizeX;
					viewPortWidthPx = pxWidth;
					viewPortWidthStartC = 0;
					viewPortWidthStartPx = 0;
					viewPortWidthStopC = viewPortWidthStartC + viewPortWidthC;
					// viewPortWidthStopPx = viewPortWidthStartPx + viewPortWidthPx;
				}

				if (VideoWorkerEngine.cameraUpdated) {
					VideoWorkerEngine.cameraUpdated = false;
					VideoWorkerEngine.post([
						{
							cmd: VideoBusOutputCmd.CAMERA,
							data: {
								heightC: viewPortHeightC,
								startXC: viewPortWidthStartC,
								startYC: viewPortHeightStartC,
								widthC: viewPortWidthC,
							},
						},
					]);
				}

				// Cache: Cells
				cacheCanvasCellAlive.height = pxCellSize;
				cacheCanvasCellAlive.width = pxCellSize;
				cacheCanvasCellAliveCtx.fillStyle = debug ? 'rgb(0,0,0)' : 'rgb(0,255,0)';
				cacheCanvasCellAliveCtx.fillRect(0, 0, pxCellSize, pxCellSize);

				cacheCanvasCellDead.height = pxCellSize;
				cacheCanvasCellDead.width = pxCellSize;
				cacheCanvasCellDeadCtx.fillStyle = debug ? 'rgb(128,0,0)' : 'rgb(0,64,0)';
				cacheCanvasCellDeadCtx.fillRect(0, 0, pxCellSize, pxCellSize);

				// Grid: Enable/Disable (auto)
				if (pxCellSize < 5) {
					drawGrid = false;
				}

				// Grid: Cache
				if (drawGrid) {
					pxHeightEff = pxHeight + pxCellSize;
					pxWidthEff = pxWidth + pxCellSize;

					cacheCanvasGridHorizontal.height = 1;
					cacheCanvasGridHorizontal.width = pxWidthEff;
					cacheCanvasGridHorizontalCtx.fillStyle = 'rgba(255,255,255,0.25)';
					cacheCanvasGridHorizontalCtx.fillRect(0, 0, pxWidthEff, 1);

					cacheCanvasGridVertical.height = pxHeightEff;
					cacheCanvasGridVertical.width = 1;
					cacheCanvasGridVerticalCtx.fillStyle = cacheCanvasGridHorizontalCtx.fillStyle;
					cacheCanvasGridVerticalCtx.fillRect(0, 0, 1, pxHeightEff);

					cacheCanvasGrids.height = pxHeightEff;
					cacheCanvasGrids.width = pxWidthEff;

					// Grid: Horizontal
					for (y = 0; y < pxHeightEff; y += pxCellSize) {
						cacheCanvasGridsCtx.drawImage(cacheCanvasGridHorizontal, 0, y);
					}

					// Grid: Vertical
					for (x = 0; x < pxWidthEff; x += pxCellSize) {
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
					statDrawAvg.watchStart();

					// Draw: Background
					if (drawDeadCells && !data.deadMode) {
						canvasOffscreenContext.fillStyle = debug ? 'rgb(128,0,0)' : 'rgb(0,64,0)';
						canvasOffscreenContext.fillRect(0, 0, pxWidth, pxHeight);
					} else {
						canvasOffscreenContext.clearRect(0, 0, pxWidth, pxHeight);
					}

					if (viewPortMode) {
						viewPortWidthStartCEff = viewPortWidthStartC - 1;
						viewPortWidthStopCEff = viewPortWidthStopC + 1;
						viewPortHeightStartCEff = viewPortHeightStartC - 1;
						viewPortHeightStopCEff = viewPortHeightStopC + 1;

						// Draw: Living Cells
						for (xy of data.alive) {
							x = (xy >> xyWidthBits) & yMask;

							if (x > viewPortWidthStartCEff && x < viewPortWidthStopCEff) {
								y = xy & yMask;

								if (y > viewPortHeightStartCEff && y < viewPortHeightStopCEff) {
									canvasOffscreenContext.drawImage(
										cacheCanvasCellAlive,
										(x - viewPortWidthStartC) * pxCellSize,
										(y - viewPortHeightStartC) * pxCellSize,
									);
								}
							}
						}

						// Clear/Draw: Dead Cells
						if (drawDeadCells) {
							if (data.deadMode) {
								// Draw dead cells
								for (xy of data.deadOrNone) {
									x = (xy >> xyWidthBits) & yMask;

									if (x > viewPortWidthStartCEff && x < viewPortWidthStopCEff) {
										y = xy & yMask;

										if (y > viewPortHeightStartCEff && y < viewPortHeightStopCEff) {
											canvasOffscreenContext.drawImage(
												cacheCanvasCellDead,
												(x - viewPortWidthStartC) * pxCellSize,
												(y - viewPortHeightStartC) * pxCellSize,
											);
										}
									}
								}
							} else {
								// Clear non-dead cells
								for (xy of data.deadOrNone) {
									x = (xy >> xyWidthBits) & yMask;

									if (x > viewPortWidthStartCEff && x < viewPortWidthStopCEff) {
										y = xy & yMask;

										if (y > viewPortHeightStartCEff && y < viewPortHeightStopCEff) {
											canvasOffscreenContext.clearRect(
												(x - viewPortWidthStartC) * pxCellSize,
												(y - viewPortHeightStartC) * pxCellSize,
												pxCellSize,
												pxCellSize,
											);
										}
									}
								}
							}
						}

						// Draw: Grid
						drawGrid &&
							canvasOffscreenContext.drawImage(
								cacheCanvasGrids,
								pxCellSize - (viewPortWidthStartPx % pxCellSize) - pxCellSize,
								pxCellSize - (viewPortHeightStartPx % pxCellSize) - pxCellSize,
							);
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
