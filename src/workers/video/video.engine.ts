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
	private static devicePixelRatioEff: number;
	private static frameCount: number = 0;
	private static frameRequest: number;
	private static framesPerMillisecond: number;
	private static frameTimestampDelta: number = 0;
	private static frameTimestampFPSThen: number = 0;
	private static frameTimestampThen: number = 0;
	private static self: Window & typeof globalThis;

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
		VideoWorkerEngine.inputResize(data);
		VideoWorkerEngine.inputSettings(data);

		// Done
		VideoWorkerEngine.post([
			{
				cmd: VideoBusOutputCmd.INIT_COMPLETE,
				data: undefined,
			},
		]);

		// Start rendering thread
		VideoWorkerEngine.frameRequest = requestAnimationFrame(VideoWorkerEngine.render);
	}

	public static inputResize(data: VideoBusInputDataResize): void {
		let devicePixelRatio: number = data.devicePixelRatio,
			height: number = Math.floor(data.height * devicePixelRatio),
			width: number = Math.floor(data.width * devicePixelRatio);

		VideoWorkerEngine.ctxHeight = height;
		VideoWorkerEngine.ctxScaler = data.scaler;
		VideoWorkerEngine.ctxWidth = width;
		VideoWorkerEngine.devicePixelRatioEff = Math.round((1 / devicePixelRatio) * 1000) / 1000;

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
	}

	private static post(VideoBusWorkerPayloads: VideoBusOutputPayload[]): void {
		VideoWorkerEngine.self.postMessage({
			payloads: VideoBusWorkerPayloads,
		});
	}

	private static render(timestampNow: number): void {
		timestampNow |= 0;

		// Start the request for the next frame
		VideoWorkerEngine.frameRequest = requestAnimationFrame(VideoWorkerEngine.render);
		VideoWorkerEngine.frameTimestampDelta = timestampNow - VideoWorkerEngine.frameTimestampThen;

		/**
		 * Send FPS to main thread every second
		 */
		if (timestampNow - VideoWorkerEngine.frameTimestampFPSThen > 999) {
			VideoWorkerEngine.post([
				{
					cmd: VideoBusOutputCmd.FPS,
					data: VideoWorkerEngine.frameCount,
				},
			]);
			VideoWorkerEngine.frameCount = 0;
			VideoWorkerEngine.frameTimestampFPSThen = timestampNow;
		}

		/**
		 * Render data at frames per ms rate
		 */
		if (VideoWorkerEngine.frameTimestampDelta > VideoWorkerEngine.framesPerMillisecond) {
			VideoWorkerEngine.frameTimestampThen =
				timestampNow - (VideoWorkerEngine.frameTimestampDelta % VideoWorkerEngine.framesPerMillisecond);
			VideoWorkerEngine.frameCount++;

			// Render blocks
			// VideoWorkerEngine.canvasOffscreenContext.font = "48px serif";
			// VideoWorkerEngine.canvasOffscreenContext.fillText("Hello world", 10, 50);
		}
	}
}
