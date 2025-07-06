import {
	CalcBusInputCmd,
	CalcBusInputDataInit,
	CalcBusInputDataSettings,
	CalcBusInputPayload,
	CalcBusOutputCmd,
	CalcBusOutputPayload,
} from './calc.model';
import { VideoBusInputDataSettingsFPS } from '../video/video.model';

/**
 * FPS determines how often data must be outputted from this webworker to the video webworker
 *
 * @author tknight-dev
 */

self.onmessage = (event: MessageEvent) => {
	const videoBusInputPayload: CalcBusInputPayload = event.data;

	switch (videoBusInputPayload.cmd) {
		case CalcBusInputCmd.INIT:
			CalcWorkerEngine.initialize(self, <CalcBusInputDataInit>videoBusInputPayload.data);
			break;
	}
};

class CalcWorkerEngine {
	private static calcCount: number = 0;
	private static calcCountTotal: number = 0;
	private static calcIterations: number;
	private static calcRequest: number;
	private static calcTimestampDelta: number = 0;
	private static calcTimestampFPSThen: number = 0;
	private static calcTimestampIPSThen: number = 0;
	private static calcTimestampThen: number = 0;
	private static framesPerMillisecond: number;
	private static iterationsPerMillisecond: number;
	private static iterationsPerSecond: number;
	private static self: Window & typeof globalThis;

	public static async initialize(self: Window & typeof globalThis, data: CalcBusInputDataInit): Promise<void> {
		// Config
		CalcWorkerEngine.self = self;

		// Engines
		CalcWorkerEngine.inputSettings(data);

		// Done
		CalcWorkerEngine.post([
			{
				cmd: CalcBusOutputCmd.INIT_COMPLETE,
				data: undefined,
			},
		]);

		// Start calc thread
		CalcWorkerEngine.calcRequest = requestAnimationFrame(CalcWorkerEngine.calc);
	}

	public static inputSettings(data: CalcBusInputDataSettings): void {
		if (data.fps === 1) {
			// Unlimited*
			CalcWorkerEngine.framesPerMillisecond = 1;
		} else {
			CalcWorkerEngine.framesPerMillisecond = (1000 / data.fps) | 0;
		}
		CalcWorkerEngine.iterationsPerMillisecond = Math.max((data.iterationsPerSecond / 1000) | 0, 1);
		CalcWorkerEngine.iterationsPerSecond = data.iterationsPerSecond;
	}

	private static post(CalcBusWorkerPayloads: CalcBusOutputPayload[]): void {
		CalcWorkerEngine.self.postMessage({
			payloads: CalcBusWorkerPayloads,
		});
	}

	private static calc(timestampNow: number): void {
		timestampNow |= 0;

		// Start the request for the next frame
		CalcWorkerEngine.calcRequest = requestAnimationFrame(CalcWorkerEngine.calc);

		/**
		 * Send data to video thread at FPS rate (if required)
		 */
		if (timestampNow - CalcWorkerEngine.calcTimestampFPSThen > CalcWorkerEngine.framesPerMillisecond) {
			CalcWorkerEngine.calcTimestampFPSThen = timestampNow;

			// TODO: Send data
		}

		/**
		 * Send iterations/second to main thread every second
		 */
		if (timestampNow - CalcWorkerEngine.calcTimestampIPSThen > 999) {
			CalcWorkerEngine.post([
				{
					cmd: CalcBusOutputCmd.IPS,
					data: {
						ips: CalcWorkerEngine.calcCount,
						ipsTotal: CalcWorkerEngine.calcCountTotal,
					},
				},
			]);
			CalcWorkerEngine.calcCount = 0;
			CalcWorkerEngine.calcTimestampIPSThen = timestampNow;
		}

		/**
		 * timestampNow is based on ms
		 */
		CalcWorkerEngine.calcTimestampDelta = timestampNow - CalcWorkerEngine.calcTimestampThen;
		if (CalcWorkerEngine.calcTimestampDelta !== 0) {
			CalcWorkerEngine.calcIterations = CalcWorkerEngine.calcTimestampDelta * CalcWorkerEngine.iterationsPerMillisecond;
			CalcWorkerEngine.calcTimestampThen = timestampNow;

			// Metrics
			CalcWorkerEngine.calcCount += CalcWorkerEngine.calcIterations;
			CalcWorkerEngine.calcCountTotal += CalcWorkerEngine.calcIterations;

			// Calc
			while (CalcWorkerEngine.calcIterations !== 0) {
				CalcWorkerEngine.calcIterations--;
			}
		}
	}
}
