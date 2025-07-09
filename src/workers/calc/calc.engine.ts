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
		case CalcBusInputCmd.LIFE:
			CalcWorkerEngine.inputLife(<Uint32Array>videoBusInputPayload.data);
			break;
		case CalcBusInputCmd.PLAY:
			CalcWorkerEngine.inputPlay();
			break;
		case CalcBusInputCmd.PAUSE:
			CalcWorkerEngine.inputPause();
			break;
		case CalcBusInputCmd.RESET:
			CalcWorkerEngine.inputReset();
			break;
		case CalcBusInputCmd.SETTINGS:
			CalcWorkerEngine.inputSettings(<CalcBusInputDataSettings>videoBusInputPayload.data);
			break;
	}
};

class CalcWorkerEngine {
	private static calcRequest: number;
	private static framesPerMillisecond: number;
	private static life: Uint32Array;
	private static lifeAvailable: boolean;
	private static iterationsPerMillisecond: number;
	private static play: boolean = true;
	private static reset: boolean;
	private static self: Window & typeof globalThis;
	private static tableSizeX: 48 | 112 | 240 | 496 | 1008 | 2032 | 8176 | 16368 | 32752;
	private static tableSizeY: number;

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

	public static inputLife(data: Uint32Array): void {
		CalcWorkerEngine.life = data;
		CalcWorkerEngine.lifeAvailable = true;
	}

	public static inputPlay(): void {
		CalcWorkerEngine.play = true;
	}

	public static inputPause(): void {
		CalcWorkerEngine.play = false;
	}

	public static inputReset(): void {
		CalcWorkerEngine.reset = true;
	}

	public static inputSettings(data: CalcBusInputDataSettings): void {
		if (data.fps === 1) {
			// Unlimited*
			CalcWorkerEngine.framesPerMillisecond = 1;
		} else {
			CalcWorkerEngine.framesPerMillisecond = (1000 / data.fps) | 0;
		}
		CalcWorkerEngine.iterationsPerMillisecond = Math.max(data.iterationsPerSecond, 1) / 1000;
		CalcWorkerEngine.tableSizeX = data.tableSizeX;
		CalcWorkerEngine.tableSizeY = (data.tableSizeX * 9) / 16;
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
		let alive: number = 0,
			calcCount: number = 0,
			calcCountTotal: number = 0,
			calcIterations: number = 0,
			calcTimestampFPSThen: number = Math.round(performance.now()),
			calcTimestampIPSDelta: number = 0,
			calcTimestampIPSThen: number = calcTimestampFPSThen,
			calcTimestampThen: number = calcTimestampFPSThen,
			data: Map<number, number> = new Map<number, number>(),
			dataNew: boolean,
			neighbors: number,
			positions: Uint32Array,
			x: number,
			xMask: number,
			xMask1: number = 0x8000, // 0x8000 is 1 << 15
			xMaskPlus1: number,
			xMaskSub1: number,
			xMax: number,
			xy: number,
			xyMaskAlive: number = 0x40000000, // 0x40000000 is 1 << 30 (alive)
			xyWorking: number,
			y: number,
			yMaskPlus1: number,
			yMaskSub1: number,
			yMax: number;

		const calc = (timestampNow: number) => {
			timestampNow |= 0;

			// Start the request for the next frame
			CalcWorkerEngine.calcRequest = requestAnimationFrame(calc);

			if (!CalcWorkerEngine.play) {
				calcCount = 0;
				calcTimestampFPSThen = timestampNow;
				calcTimestampIPSThen = timestampNow;
				calcTimestampThen = timestampNow;
				return;
			}

			/**
			 * Reset
			 */
			if (CalcWorkerEngine.reset) {
				CalcWorkerEngine.reset = false;

				calcCount = 0;
				calcCountTotal = 0;
				data.clear(); // TODO: Replace with the original seed (if available)

				calcTimestampFPSThen = timestampNow;
				calcTimestampIPSThen = timestampNow;
				calcTimestampThen = timestampNow;
				return;
			}

			/**
			 * Send data to video thread at FPS rate (if required)
			 */
			if (dataNew && timestampNow - calcTimestampFPSThen > CalcWorkerEngine.framesPerMillisecond) {
				calcTimestampFPSThen = timestampNow;
				dataNew = false;

				// Post postions
				positions = Uint32Array.from(data.keys());
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
			calcTimestampIPSDelta = timestampNow - calcTimestampIPSThen;
			if (calcTimestampIPSDelta > 999) {
				CalcWorkerEngine.post([
					{
						cmd: CalcBusOutputCmd.PS,
						data: {
							alive: alive,
							dead: data.size - alive,
							ips: calcCount,
							ipsDeltaInMS: calcTimestampIPSDelta,
							ipsTotal: calcCountTotal,
						},
					},
				]);
				calcCount = 0;
				calcTimestampIPSThen = timestampNow;
			}

			/**
			 * Life: manually added by user
			 */
			if (CalcWorkerEngine.lifeAvailable) {
				CalcWorkerEngine.lifeAvailable = false;

				for (xy of CalcWorkerEngine.life) {
					data.set(xy, 0);
				}
			}

			/**
			 * timestampNow is based on ms
			 */
			calcIterations = ((timestampNow - calcTimestampThen) * CalcWorkerEngine.iterationsPerMillisecond) | 0;
			if (calcIterations !== 0) {
				calcTimestampThen = timestampNow;
				dataNew = true;

				// Metrics
				calcCount += calcIterations;
				calcCountTotal += calcIterations;

				// Config
				xMax = CalcWorkerEngine.tableSizeX;
				yMax = CalcWorkerEngine.tableSizeY;

				// Calc
				while (calcIterations !== 0) {
					calcIterations--;

					/**
					 * Neighbors
					 *
					 * Consider: Diagonals, Horizontal, and Veritical cells
					 */
					for (xy of data.keys()) {
						if ((xy & xyMaskAlive) === 0) {
							// dead cell
							continue;
						}

						// Decode x & y
						xMask = xy & 0x3fff8000; // 0x3FFF8000 is 0x7fff << 15
						x = xMask >> 15;
						y = xy & 0x7fff;

						// Neighbors: Middle
						if (y !== yMax) {
							// Neighbors: Above
							yMaskPlus1 = y + 1;
							xyWorking = xMask | yMaskPlus1;
							data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
						} else {
							yMaskPlus1 = 0;
						}

						if (y !== 0) {
							// Neighbors: Below
							yMaskSub1 = y - 1;
							xyWorking = xMask | yMaskSub1;
							data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
						} else {
							yMaskSub1 = 0;
						}

						// Neighbors: Left
						if (x !== 0) {
							xMaskSub1 = xMask - xMask1;

							// Neighbors: Above
							if (yMaskPlus1 !== 0) {
								xyWorking = xMaskSub1 | yMaskPlus1;
								data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
							}

							// Neighbors: Middle
							xyWorking = xMaskSub1 | y;
							data.set(xyWorking, (data.get(xyWorking) || 0) + 1);

							// Neighbors: Below
							if (yMaskSub1 !== 0) {
								xyWorking = xMaskSub1 | yMaskSub1;
								data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
							}
						}

						// Neighbors: Right
						if (x !== xMax) {
							xMaskPlus1 = xMask + xMask1;

							// Neighbors: Above
							if (yMaskPlus1 !== 0) {
								xyWorking = xMaskPlus1 | yMaskPlus1;
								data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
							}

							// Neighbors: Middle
							xyWorking = xMaskPlus1 | y;
							data.set(xyWorking, (data.get(xyWorking) || 0) + 1);

							// Neighbors: Below
							if (yMaskSub1 !== 0) {
								xyWorking = xMaskPlus1 | yMaskSub1;
								data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
							}
						}
					}

					/**
					 * Living Cells (reset neighbor count while iterating)
					 *
					 * 1. Any live cell with fewer than two live neighbors		- Dies (underpopulation)
					 * 2. Any live cell with two or three live neighbors		- Stays alive
					 * 3. Any live cell with more than three live neighbors		- Dies (overpopulation)
					 * 4. Any dead cell with exactly three live neighbors		- Becomes alive (reproduction)
					 */
					alive = 0;
					for ([xy, neighbors] of data) {
						if ((xy & xyMaskAlive) !== 0) {
							if (neighbors === 2 || neighbors === 3) {
								// Rule 2
								alive++;
								data.set(xy, 0);
							} else {
								// Rule 1 & Rule 3
								data.set(xy & ~xyMaskAlive, 0);
								data.delete(xy);
							}
						} else if (neighbors === 3) {
							// Rule 4
							alive++;
							data.set(xy | xyMaskAlive, 0);
							data.delete(xy);
						} else {
							data.set(xy, 0);
						}
					}
				}
			}
		};
		CalcWorkerEngine.calc = calc;
	}
}
