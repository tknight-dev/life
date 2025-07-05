import { VideoBusInputCmd, VideoBusInputDataInit, VideoBusInputPayload, VideoBusOutputCmd, VideoBusOutputPayload } from './video.model';

/**
 * @author tknight-dev
 */

export class VideoBusEngine {
	private static callbackInitComplete: () => void;
	private static canvas: HTMLCanvasElement;
	private static canvasOffscreen: OffscreenCanvas;
	private static worker: Worker;

	/**
	 * Start the video streams in another thread
	 */
	public static initialize(canvas: HTMLCanvasElement, callback: () => void): void {
		VideoBusEngine.callbackInitComplete = callback;
		VideoBusEngine.canvas = canvas;
		VideoBusEngine.canvasOffscreen = canvas.transferControlToOffscreen();

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
			const videoBusInputDataInit: VideoBusInputDataInit = {
				canvasOffscreen: VideoBusEngine.canvasOffscreen,
			};
			const videoBusInputPayload: VideoBusInputPayload = {
				cmd: VideoBusInputCmd.INIT,
				data: videoBusInputDataInit,
			};
			VideoBusEngine.worker.postMessage(videoBusInputPayload, [VideoBusEngine.canvasOffscreen]);
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
						VideoBusEngine.callbackInitComplete();
						break;
				}
			}
		};
	}
}
