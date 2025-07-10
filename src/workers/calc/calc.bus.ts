import {
	CalcBusInputCmd,
	CalcBusInputDataInit,
	CalcBusInputDataSettings,
	CalcBusInputPayload,
	CalcBusOutputCmd,
	CalcBusOutputDataPS,
	CalcBusOutputPayload,
} from './calc.model';
import { VideoBusEngine } from '../video/video.bus';

/**
 * @author tknight-dev
 */

export class CalcBusEngine {
	private static callbackGameOver: (dead: number) => void;
	private static callbackInitComplete: () => void;
	private static callbackPS: (data: CalcBusOutputDataPS) => void;
	private static worker: Worker;

	/**
	 * Start the video streams in another thread
	 */
	public static initialize(life: Uint32Array, settings: CalcBusInputDataSettings, callback: () => void): void {
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
			const videoBusInputDataInit: CalcBusInputDataInit = Object.assign(
				{
					life: life,
				},
				settings,
			);
			const videoBusInputPayload: CalcBusInputPayload = {
				cmd: CalcBusInputCmd.INIT,
				data: videoBusInputDataInit,
			};
			CalcBusEngine.worker.postMessage(videoBusInputPayload, [life.buffer]);
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
					case CalcBusOutputCmd.GAME_OVER:
						CalcBusEngine.callbackGameOver(<number>payloads[i].data);
						break;
					case CalcBusOutputCmd.INIT_COMPLETE:
						CalcBusEngine.callbackInitComplete();
						break;
					case CalcBusOutputCmd.PS:
						CalcBusEngine.callbackPS(<CalcBusOutputDataPS>payloads[i].data);
						break;
					case CalcBusOutputCmd.POSITIONS:
						VideoBusEngine.outputData(<Uint32Array>payloads[i].data);
						break;
				}
			}
		};
	}

	public static outputLife(data: Uint32Array): void {
		CalcBusEngine.worker.postMessage(
			{
				cmd: CalcBusInputCmd.LIFE,
				data: data,
			},
			[data.buffer],
		);
	}

	public static outputPlay(): void {
		CalcBusEngine.worker.postMessage({
			cmd: CalcBusInputCmd.PLAY,
			data: undefined,
		});
	}

	public static outputPause(): void {
		CalcBusEngine.worker.postMessage({
			cmd: CalcBusInputCmd.PAUSE,
			data: undefined,
		});
	}

	public static outputReset(): void {
		CalcBusEngine.worker.postMessage({
			cmd: CalcBusInputCmd.RESET,
			data: undefined,
		});
	}

	public static outputSettings(data: CalcBusInputDataSettings): void {
		CalcBusEngine.worker.postMessage({
			cmd: CalcBusInputCmd.SETTINGS,
			data: data,
		});
	}

	public static setCallbackGameOver(callbackGameOver: (dead: number) => void): void {
		CalcBusEngine.callbackGameOver = callbackGameOver;
	}

	public static setCallbackPS(callbackPS: (data: CalcBusOutputDataPS) => void): void {
		CalcBusEngine.callbackPS = callbackPS;
	}
}
