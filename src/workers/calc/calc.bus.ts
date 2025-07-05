import { CalcBusInputCmd, CalcBusInputDataInit, CalcBusInputPayload, CalcBusOutputCmd, CalcBusOutputPayload } from './calc.model';

/**
 * @author tknight-dev
 */

export class CalcBusEngine {
	private static callbackInitComplete: () => void;
	private static worker: Worker;

	/**
	 * Start the video streams in another thread
	 */
	public static initialize(callback: () => void): void {
		CalcBusEngine.callbackInitComplete = callback;

		// Spawn Calc thread
		if (window.Worker) {
			CalcBusEngine.worker = new Worker(new URL('./calc.engine.mjs', import.meta.url), {
				name: 'CalcWorkerEngine',
				type: 'module',
			});

			// Setup listener
			CalcBusEngine.input();

			/*
			 * Initialization payload
			 */
			const videoBusInputDataInit: CalcBusInputDataInit = {};
			const videoBusInputPayload: CalcBusInputPayload = {
				cmd: CalcBusInputCmd.INIT,
				data: videoBusInputDataInit,
			};
			CalcBusEngine.worker.postMessage(videoBusInputPayload);
		} else {
			alert('Web Workers are not supported by your browser');
		}
	}

	/*
	 * Commands from worker (typically audio effect triggers)
	 */
	private static input(): void {
		CalcBusEngine.worker.onmessage = async (event: MessageEvent) => {
			const payloads: CalcBusOutputPayload[] = event.data.payloads;

			for (let i = 0; i < payloads.length; i++) {
				switch (payloads[i].cmd) {
					case CalcBusOutputCmd.INIT_COMPLETE:
						CalcBusEngine.callbackInitComplete();
						break;
				}
			}
		};
	}
}
