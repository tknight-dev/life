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
		CalcWorkerEngine.iterationsPerMillisecond = Math.max(data.iterationsPerSecond, 1) / 1000;
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

	/**
	 * Refactor to use maps instead of objects?
	 * Refactor to use smaller table size and encode x,y as single int and use map to store neighbor count
	 */
	private static calcBinder(): void {
		let calcCount: number = 0,
			calcCountTotal: number = 0,
			calcIterations: number = 0,
			calcTimestampFPSThen: number = 0,
			calcTimestampIPSThen: number = 0,
			calcTimestampThen: number = 0,
			data: Map<number, number> = new Map<number, number>(),
			dataNew: boolean,
			neighbors: number,
			positions: Uint32Array,
			x: number,
			xMask: number,
			xMask1: number = 0x8000, // 0x8000 is 1 << 15
			xMaskPlus1: number,
			xMaskSub1: number,
			xMax: number = 32752,
			xy: number,
			xyMaskAlive: number = 0x40000000, // 0x40000000 is 1 << 30 (alive)
			xyWorking: number,
			y: number,
			yMaskPlus1: number,
			yMaskSub1: number,
			yMax: number = 18423,
			yPlus1Available: boolean, // down the graph visually
			ySub1Available: boolean; // up the graph visually

		const calc = (timestampNow: number) => {
			timestampNow |= 0;

			// Start the request for the next frame
			CalcWorkerEngine.calcRequest = requestAnimationFrame(calc);

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
			calcIterations = ((timestampNow - calcTimestampThen) * CalcWorkerEngine.iterationsPerMillisecond) | 0;
			if (calcIterations !== 0) {
				calcTimestampThen = timestampNow;
				dataNew = true;

				// Metrics
				calcCount += calcIterations;
				calcCountTotal += calcIterations;

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
						x = (xy >> 15) & 0x7fff;
						xMask = xy & 0x3fff8000; // 0x3FFF8000 is 0x7fff << 15
						y = xy & 0x7fff;

						// Cache checks
						yPlus1Available = y !== yMax;
						ySub1Available = y !== 0;

						// Middle Vertical
						if (yPlus1Available) {
							// Up
							yMaskPlus1 = y + 1;
							xyWorking = xMask | yMaskPlus1;
							data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
						}
						if (ySub1Available) {
							// Down
							yMaskSub1 = y - 1;
							xyWorking = xMask | yMaskSub1;
							data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
						}

						// Left Vertical
						if (x !== 0) {
							xMaskSub1 = xMask - xMask1;

							// Up
							if (yPlus1Available) {
								xyWorking = xMaskSub1 | yMaskPlus1;
								data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
							}

							// Middle
							xyWorking = xMaskSub1 | y;
							data.set(xyWorking, (data.get(xyWorking) || 0) + 1);

							// Down
							if (ySub1Available) {
								xyWorking = xMaskSub1 | yMaskSub1;
								data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
							}
						}

						// Right Vertical
						if (x !== xMax) {
							xMaskPlus1 = xMask + xMask1;

							// Up
							if (yPlus1Available) {
								xyWorking = xMaskPlus1 | yMaskPlus1;
								data.set(xyWorking, (data.get(xyWorking) || 0) + 1);
							}

							// Middle
							xyWorking = xMaskPlus1 | y;
							data.set(xyWorking, (data.get(xyWorking) || 0) + 1);

							// Down
							if (ySub1Available) {
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
					for ([xy, neighbors] of data) {
						if ((xy & xyMaskAlive) !== 0) {
							if (neighbors === 2 || neighbors === 3) {
								// Rule 2
								data.set(xy, 0);
							} else {
								// Rule 1 & Rule 3
								data.set(xy & ~xyMaskAlive, 0);
								data.delete(xy);
							}
						} else if (neighbors === 3) {
							// Rule 4
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
