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
	private static canvasOffscreenContext: WebGLRenderingContext;
	private static ctxHeight: number;
	private static ctxScaler: number;
	private static ctxWidth: number;
	private static data: Uint32Array;
	private static dataNew: boolean;
	private static devicePixelRatioEff: number;
	private static frameRequest: number;
	private static framesPerMillisecond: number;
	private static grid: boolean;
	private static self: Window & typeof globalThis;
	private static tableSizeX: 48 | 112 | 240 | 496 | 1008 | 2032 | 8176 | 16368 | 32752;
	private static tableSizeY: number;

	public static async initialize(self: Window & typeof globalThis, data: VideoBusInputDataInit): Promise<void> {
		// Config
		VideoWorkerEngine.canvasOffscreen = data.canvasOffscreen;
		VideoWorkerEngine.canvasOffscreenContext = <WebGLRenderingContext>data.canvasOffscreen.getContext('webgl');
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

		VideoWorkerEngine.canvasOffscreen.height = height;
		VideoWorkerEngine.canvasOffscreen.width = width;
		VideoWorkerEngine.canvasOffscreenContext.viewport(0, 0, width, height);
	}

	public static inputSettings(data: VideoBusInputDataSettings): void {
		if (data.fps === 1) {
			// Unlimited*
			VideoWorkerEngine.framesPerMillisecond = 1;
		} else {
			VideoWorkerEngine.framesPerMillisecond = (1000 / data.fps) | 0;
		}
		VideoWorkerEngine.grid = data.grid;
		VideoWorkerEngine.tableSizeX = data.tableSizeX;
		VideoWorkerEngine.tableSizeY = (data.tableSizeX * 9) / 16;
	}

	private static post(VideoBusWorkerPayloads: VideoBusOutputPayload[]): void {
		VideoWorkerEngine.self.postMessage({
			payloads: VideoBusWorkerPayloads,
		});
	}

	private static render(timestampNow: number): void {}

	// DELETE ME
	private static drawScene(gl: WebGLRenderingContext, shaderProgram: WebGLProgram, buffer: WebGLBuffer, vertexPosition: number): void {}

	private static renderBinder(): boolean {
		/**
		 * FPS
		 */
		let frameCount: number = 0,
			frameTimestampDelta: number = 0,
			frameTimestampFPSThen: number = 0,
			frameTimestampThen: number = 0;

		/**
		 * WebGL
		 */
		const gl: WebGLRenderingContext = VideoWorkerEngine.canvasOffscreenContext,
			buffer: WebGLBuffer = gl.createBuffer(),
			shaderFragment: WebGLShader | null = VideoWorkerEngine.renderShaderLoad(
				gl,
				gl.FRAGMENT_SHADER,
				VideoWorkerEngine.renderShaderSourceFragment(),
			),
			shaderProgram: WebGLProgram = gl.createProgram(),
			shaderVertex: WebGLShader | null = VideoWorkerEngine.renderShaderLoad(
				gl,
				gl.VERTEX_SHADER,
				VideoWorkerEngine.renderShaderSourceVertex(),
			);

		if (shaderFragment === null || shaderVertex === null) {
			return false;
		}

		// Load program into the GPU
		gl.attachShader(shaderProgram, shaderFragment);
		gl.attachShader(shaderProgram, shaderVertex);
		gl.linkProgram(shaderProgram);
		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			console.error('Engine > Video: failed to start program:', gl.getProgramInfoLog(shaderProgram));
			return false;
		}

		// Final values
		const vertexPosition: number = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

		/**
		 * Render
		 */
		const render = (timestampNow: number) => {
			timestampNow |= 0;

			// Start the request for the next frame
			VideoWorkerEngine.frameRequest = requestAnimationFrame(render);
			frameTimestampDelta = timestampNow - frameTimestampThen;

			if (VideoWorkerEngine.dataNew) {
				VideoWorkerEngine.dataNew = false;

				// Load data into buffer :)
			}

			/**
			 * Render data at frames per ms rate
			 */
			if (frameTimestampDelta > VideoWorkerEngine.framesPerMillisecond) {
				frameTimestampThen = timestampNow - (frameTimestampDelta % VideoWorkerEngine.framesPerMillisecond);
				frameCount++;

				// Render data

				// mock data
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0, 0.75, -0.75, -0.75, 0.75, -0.75]), gl.STATIC_DRAW);

				// mock draw
				VideoWorkerEngine.drawScene(gl, shaderProgram, buffer, gl.getAttribLocation(shaderProgram, 'aVertexPosition'));
				gl.clearColor(0.0, 0.0, 0.0, 1.0);
				gl.clear(gl.COLOR_BUFFER_BIT);

				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0);
				gl.enableVertexAttribArray(vertexPosition);

				gl.useProgram(shaderProgram);

				gl.drawArrays(gl.TRIANGLES, 0, 3); // *, offset, count
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

	/**
	 * @param type from `WebGLRenderingContextBase.` enum
	 */
	private static renderShaderLoad(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
		const shader: WebGLShader | null = gl.createShader(type);

		if (!shader) {
			console.error('Engine > Video: failed to create shader');
			return null;
		}

		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error('Engine > Video: failed to compile shader:', gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}

		return shader;
	}

	private static renderShaderSourceFragment(): string {
		return `
		    void main() {
		        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red color
		    }
		`;
	}

	private static renderShaderSourceVertex(): string {
		return `
		    attribute vec4 aVertexPosition;

		    void main() {
		        gl_Position = aVertexPosition;
		    }
		`;
	}
}
