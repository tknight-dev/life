import {
	CalcBusInputCmd,
	CalcBusInputDataInit,
	CalcBusInputDataSettings,
	CalcBusInputPayload,
	CalcBusOutputCmd,
	CalcBusOutputDataPositions,
	CalcBusOutputDataSave,
	CalcBusOutputDataStats,
	CalcBusOutputPayload,
} from './calc.model';
import { VideoBusEngine } from '../video/video.bus';

/**
 * @author tknight-dev
 */

export class CalcBusEngine {
	private static callbackGameOver: () => void;
	private static callbackHomeostatic: () => void;
	private static callbackInitComplete: () => void;
	private static callbackSave: (data: CalcBusOutputDataSave) => void;
	private static callbackSpinOut: () => void;
	private static callbackStats: (data: CalcBusOutputDataStats) => void;
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
						CalcBusEngine.callbackGameOver();
						break;
					case CalcBusOutputCmd.HOMEOSTATIC:
						CalcBusEngine.callbackHomeostatic();
						break;
					case CalcBusOutputCmd.INIT_COMPLETE:
						CalcBusEngine.callbackInitComplete();
						break;
					case CalcBusOutputCmd.POSITIONS:
						VideoBusEngine.outputData(<CalcBusOutputDataPositions>payloads[i].data);
						break;
					case CalcBusOutputCmd.SAVE:
						CalcBusEngine.callbackSave(<CalcBusOutputDataSave>payloads[i].data);
						break;
					case CalcBusOutputCmd.SPIN_OUT:
						CalcBusEngine.callbackSpinOut();
						break;
					case CalcBusOutputCmd.STATS:
						CalcBusEngine.callbackStats(<CalcBusOutputDataStats>payloads[i].data);
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

	public static outputReset(data?: Uint32Array): void {
		if (data) {
			CalcBusEngine.worker.postMessage(
				{
					cmd: CalcBusInputCmd.RESET,
					data: data,
				},
				[data.buffer],
			);
		} else {
			CalcBusEngine.worker.postMessage({
				cmd: CalcBusInputCmd.RESET,
				data: undefined,
			});
		}
	}

	public static outputRestore(data: CalcBusOutputDataSave): void {
		CalcBusEngine.worker.postMessage(
			{
				cmd: CalcBusInputCmd.RESTORE,
				data: data,
			},
			[data.alive.buffer, data.dead.buffer],
		);
	}

	public static outputSave(): void {
		CalcBusEngine.worker.postMessage({
			cmd: CalcBusInputCmd.SAVE,
			data: undefined,
		});
	}

	public static outputSettings(data: CalcBusInputDataSettings): void {
		CalcBusEngine.worker.postMessage({
			cmd: CalcBusInputCmd.SETTINGS,
			data: data,
		});
	}

	public static setCallbackGameOver(callbackGameOver: () => void): void {
		CalcBusEngine.callbackGameOver = callbackGameOver;
	}

	public static setCallbackHomeostatic(callbackHomeostatic: () => void): void {
		CalcBusEngine.callbackHomeostatic = callbackHomeostatic;
	}

	public static setCallbackSave(callbackSave: (data: CalcBusOutputDataSave) => void): void {
		CalcBusEngine.callbackSave = callbackSave;
	}

	public static setCallbackSpinOut(callbackSpinOut: () => void): void {
		CalcBusEngine.callbackSpinOut = callbackSpinOut;
	}

	public static setCallbackStats(callbackStats: (data: CalcBusOutputDataStats) => void): void {
		CalcBusEngine.callbackStats = callbackStats;
	}
}
