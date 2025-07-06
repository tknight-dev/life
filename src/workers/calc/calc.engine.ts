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
	private static calcRequest: number;
	private static framesPerMillisecond: number;
	private static iterationsPerMillisecond: number;
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
		CalcWorkerEngine.calcBinder();
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
	}

	private static post(CalcBusWorkerPayloads: CalcBusOutputPayload[], data: any[] = []): void {
		CalcWorkerEngine.self.postMessage(
			{
				payloads: CalcBusWorkerPayloads,
			},
			<any>data,
		);
	}

	private static calc(timestampNow: number): void {}

	private static calcBinder(): void {
		let calcCount: number = 0,
			calcCountTotal: number = 0,
			calcIterations: number = 0,
			calcTimestampDelta: number = 0,
			calcTimestampFPSThen: number = 0,
			calcTimestampIPSThen: number = 0,
			calcTimestampThen: number = 0,
			dataByY: { [key: number]: number } = {}, // y: neighbor count
			dataByYByX: { [key: number]: { [key: number]: number } } = {}, // x, y: neighbor count
			dataByYByXPrevious: { [key: number]: { [key: number]: number } } = {},
			dataFinalByYByX: { [key: number]: { [key: number]: null } } = {}, // x, y
			dataFinalByY: { [key: number]: null } = {}, // x, y
			dataFinalByYByXPrevious: { [key: number]: { [key: number]: null } } = {}, // x, y
			dataFinalByYPrevious: { [key: number]: null } = {}, // y
			dataFinalSize: number,
			i: number,
			positions: Uint32Array,
			tableMax: number = 65536, // 65535 is max, but the logic uses '<'
			value: number,
			x: number,
			xPlus1: number,
			xPlus1Available: boolean,
			xSub1: number,
			xSub1Available: boolean,
			xString: string,
			y: number,
			yPlus1: number, // down the graph visually
			yPlus1Available: boolean, // down the graph visually
			ySub1: number, // up the graph visually
			ySub1Available: boolean, // up the graph visually
			yString: string;

		/**
		 * Consider: Diagonals, Horizontal, and Veritical cells
		 *
		 * Any live cell with fewer than two live neighbors		- Dies (underpopulation)
		 * Any live cell with two or three live neighbors		- Stays alive
		 * Any live cell with more than three live neighbors	- Dies (overpopulation)
		 * Any dead cell with exactly three live neighbors		- Becomes alive (reproduction)
		 */
		const calc = (timestampNow: number) => {
			timestampNow |= 0;

			// Start the request for the next frame
			CalcWorkerEngine.calcRequest = requestAnimationFrame(calc);

			/**
			 * Send data to video thread at FPS rate (if required)
			 */
			if (timestampNow - calcTimestampFPSThen > CalcWorkerEngine.framesPerMillisecond) {
				calcTimestampFPSThen = timestampNow;

				// Format data as an array of unsigned ints
				i = 0;
				positions = new Uint32Array(dataFinalSize); // 134MB max
				for (xString in dataFinalByYByX) {
					x = Number(xString);

					for (yString in dataFinalByYByX[xString]) {
						y = Number(yString);

						// uint32: 16bits=x,16bits=y
						positions[i] = ((x & 0xffff) << 16) | (y & 0xffff);
						i++;
					}
				}

				// Post postions
				CalcWorkerEngine.post(
					[
						{
							cmd: CalcBusOutputCmd.POSITIONS,
							data: positions,
						},
					],
					[positions.buffer],
				);
			}

			/**
			 * Send iterations/second to main thread every second
			 */
			if (timestampNow - calcTimestampIPSThen > 999) {
				CalcWorkerEngine.post([
					{
						cmd: CalcBusOutputCmd.IPS,
						data: {
							ips: calcCount,
							ipsTotal: calcCountTotal,
						},
					},
				]);
				calcCount = 0;
				calcTimestampIPSThen = timestampNow;
			}

			/**
			 * timestampNow is based on ms
			 */
			calcTimestampDelta = timestampNow - calcTimestampThen;
			if (calcTimestampDelta !== 0) {
				calcIterations = calcTimestampDelta * CalcWorkerEngine.iterationsPerMillisecond;
				calcTimestampThen = timestampNow;

				// Config
				dataByYByXPrevious = dataByYByX;
				dataFinalByYByXPrevious = dataFinalByYByX;

				// Metrics
				calcCount += calcIterations;
				calcCountTotal += calcIterations;

				// Reset
				dataByYByX = <any>new Object();
				dataFinalByYByX = <any>new Object();
				dataFinalSize = 0;

				// Calc: neighbors
				while (calcIterations !== 0) {
					calcIterations--;

					// Iterate over current live cells
					for (xString in dataByYByXPrevious) {
						x = Number(xString);

						dataByYByX[x] = {}; // Prepare for y counts
						xSub1 = x - 1;
						xSub1Available = xSub1 > -1; // 0 is min
						xPlus1 = x + 1;
						xPlus1Available = x + 1 < tableMax;

						for (yString in dataByYByXPrevious[xString]) {
							y = Number(yString);
							ySub1 = y - 1;
							ySub1Available = ySub1 > -1; // 0 is min
							yPlus1 = y + 1;
							yPlus1Available = yPlus1 < tableMax;

							// Middle
							dataByY = dataByYByX[x];

							dataByY[y] = (dataByY[y] || 0) + 1;
							yPlus1Available && (dataByY[yPlus1] = (dataByY[yPlus1] || 0) + 1);
							ySub1Available && (dataByY[ySub1] = (dataByY[ySub1] || 0) + 1);

							// Left by 1
							if (xSub1Available) {
								dataByY = dataByYByX[xSub1];

								dataByY[y] = (dataByY[y] || 0) + 1;
								yPlus1Available && (dataByY[yPlus1] = (dataByY[yPlus1] || 0) + 1);
								ySub1Available && (dataByY[ySub1] = (dataByY[ySub1] || 0) + 1);
							}

							// Right by 1
							if (xPlus1Available) {
								dataByY = dataByYByX[xPlus1];

								dataByY[y] = (dataByY[y] || 0) + 1;
								yPlus1Available && (dataByY[yPlus1] = (dataByY[yPlus1] || 0) + 1);
								ySub1Available && (dataByY[ySub1] = (dataByY[ySub1] || 0) + 1);
							}
						}
					}
				}

				// Calc: living cells
				for (xString in dataByYByX) {
					x = Number(xString);
					dataByY = dataByYByX[xString];

					dataFinalByYPrevious = dataFinalByYByXPrevious[xString];

					for (yString in dataByYByX[xString]) {
						y = Number(yString);
						value = dataByY[yString];

						// 2 neighbors is still-alive
						// 3 neighbors is still-alive or born
						if (value === 3 || (value === 2 && dataFinalByYPrevious[yString] === null)) {
							dataFinalSize++;
							dataFinalByY = dataFinalByYByX[xString];

							if (dataFinalByY) {
								dataFinalByY[yString] = null;
							} else {
								dataFinalByYByX[xString] = {
									[yString]: null,
								};
							}
						}
					}
				}
			}
		};
		CalcWorkerEngine.calc = calc;
	}
}
