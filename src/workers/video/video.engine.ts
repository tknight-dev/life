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
	private static ctxWidth: number;
	private static data: Uint32Array;
	private static dataNew: boolean;
	private static drawDeadCells: boolean;
	private static drawGrid: boolean;
	private static frameRequest: number;
	private static framesPerMillisecond: number;
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

	private static render(timestampNow: number): void {}

	private static renderBinder(): boolean {
		let cache: boolean,
			cacheCanvasCell: OffscreenCanvas,
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
			data: Uint32Array,
			drawDeadCells: boolean,
			drawGrid: boolean,
			frameCount: number = 0,
			frameTimestampDelta: number = 0,
			frameTimestampFPSThen: number = 0,
			frameTimestampThen: number = 0,
			pxCellSize: number,
			pxHeight: number,
			pxWidth: number,
			tableSizeX: number,
			x: number,
			xy: number,
			xyMaskAlive: number = 1 << 22, // See calc.engine.ts
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

			if (VideoWorkerEngine.dataNew) {
				VideoWorkerEngine.dataNew = false;

				cache = false;
				data = VideoWorkerEngine.data;

				// TODO create differential from previous to new.. and only draw the new information ... yesss... dead cells are the most expensive to draw (lots of ram)

				// idea: draw dead as one large rect and then use clearRects to remove them as required (can only improve performance with random value starts)
				// if data.size > tableX * tableY / 2 ... then use clearRect else draw dead cell .... how do we clearRect unknown positions (not in data array)
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

				// pxCellSize = Math.max(1, Math.round(pxWidth / tableSizeX));
				pxCellSize = pxWidth / tableSizeX;
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
			if (!cache && frameTimestampDelta > VideoWorkerEngine.framesPerMillisecond) {
				frameTimestampThen = timestampNow - (frameTimestampDelta % VideoWorkerEngine.framesPerMillisecond);
				frameCount++;

				// Clear
				canvasOffscreenContext.clearRect(0, 0, pxWidth, pxHeight);

				// Cells
				for (xy of data) {
					x = (xy >> 11) & 0x7ff;
					y = xy & 0x7ff;

					if (drawDeadCells) {
						cacheCanvasCell = (xy & xyMaskAlive) !== 0 ? cacheCanvasCellAlive : cacheCanvasCellDead;
						canvasOffscreenContext.drawImage(cacheCanvasCell, x * pxCellSize, y * pxCellSize);
					} else if ((xy & xyMaskAlive) !== 0) {
						canvasOffscreenContext.drawImage(cacheCanvasCellAlive, x * pxCellSize, y * pxCellSize);
					}
				}

				// Grid
				if (drawGrid) {
					canvasOffscreenContext.drawImage(cacheCanvasGrids, 0, 0);
				}

				cache = true;
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
