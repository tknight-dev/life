import {
	CalcBusInputCmd,
	CalcBusInputDataInit,
	CalcBusInputDataSettings,
	CalcBusInputPayload,
	CalcBusOutputCmd,
	CalcBusOutputDataIPS,
	CalcBusOutputPayload,
} from './calc.model';
import { VideoBusInputDataSettingsFPS } from '../video/video.model';

/**
 * @author tknight-dev
 */

export class CalcBusEngine {
	private static callbackInitComplete: () => void;
	private static callbackIPS: (data: CalcBusOutputDataIPS) => void;
	private static worker: Worker;

	/**
	 * Start the video streams in another thread
	 */
	public static initialize(settings: CalcBusInputDataSettings, callback: () => void): void {
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
			const videoBusInputDataInit: CalcBusInputDataInit = Object.assign({}, settings);
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
					case CalcBusOutputCmd.IPS:
						CalcBusEngine.callbackIPS(<CalcBusOutputDataIPS>payloads[i].data);
						break;
				}
			}
		};
	}

	public static outputSettings(data: CalcBusInputDataSettings): void {
		CalcBusEngine.worker.postMessage({
			cmd: CalcBusInputCmd.SETTINGS,
			data: data,
		});
	}

	public static setCallbackIPS(callbackIPS: (data: CalcBusOutputDataIPS) => void): void {
		CalcBusEngine.callbackIPS = callbackIPS;
	}
}
