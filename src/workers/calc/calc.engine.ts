import {
	CalcBusInputCmd,
	CalcBusInputDataInit,
	CalcBusInputDataSettings,
	CalcBusInputPayload,
	CalcBusOutputCmd,
	CalcBusOutputPayload,
	masks,
	Stat,
	Stats,
	xyWidthBits,
} from './calc.model';

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
			CalcWorkerEngine.inputReset(<Uint32Array | undefined>videoBusInputPayload.data);
			break;
		case CalcBusInputCmd.SETTINGS:
			CalcWorkerEngine.inputSettings(<CalcBusInputDataSettings>videoBusInputPayload.data);
			break;
	}
};

interface CellMeta {
	alive: number;
	dead: number;
	neighbors: number;
}

class CalcWorkerEngine {
	private static calcRequest: number;
	private static cpuSpinOutProtection: boolean;
	private static homeostaticPause: boolean;
	private static framesPerMillisecond: number;
	private static life: Uint32Array[] = [];
	private static iterationsPerMillisecond: number;
	private static play: boolean;
	private static reset: boolean;
	private static self: Window & typeof globalThis;
	private static stats: { [key: number]: Stat } = {};
	private static tableSizeAltered: boolean;
	private static tableSizeX: 48 | 112 | 240 | 496 | 1008 | 2032 | 8176 | 16368 | 32752;
	private static tableSizeY: number;

	public static async initialize(self: Window & typeof globalThis, data: CalcBusInputDataInit): Promise<void> {
		// Config
		CalcWorkerEngine.self = self;

		// Engines
		CalcWorkerEngine.inputLife(data.life);
		CalcWorkerEngine.inputSettings(data);

		// Stats
		CalcWorkerEngine.stats[Stats.CALC_HOMEOSTASIS_AVG] = new Stat();
		CalcWorkerEngine.stats[Stats.CALC_NEIGHBORS_AVG] = new Stat();
		CalcWorkerEngine.stats[Stats.CALC_STATE_AVG] = new Stat();

		// Done
		CalcWorkerEngine.post([
			{
				cmd: CalcBusOutputCmd.INIT_COMPLETE,
				data: undefined,
			},
		]);

		// Start calc thread
		CalcWorkerEngine.calcBinder();
		CalcWorkerEngine.tableSizeAltered = false;
		CalcWorkerEngine.reset = true;
		CalcWorkerEngine.calcRequest = requestAnimationFrame(CalcWorkerEngine.calc);
	}

	public static inputLife(data: Uint32Array): void {
		CalcWorkerEngine.life.push(data);
	}

	public static inputPlay(): void {
		CalcWorkerEngine.play = true;
	}

	public static inputPause(): void {
		CalcWorkerEngine.play = false;
	}

	public static inputReset(data?: Uint32Array): void {
		CalcWorkerEngine.reset = true;

		if (data) {
			CalcWorkerEngine.inputLife(data);
		}
	}

	public static inputSettings(data: CalcBusInputDataSettings): void {
		CalcWorkerEngine.cpuSpinOutProtection = data.cpuSpinOutProtection;
		CalcWorkerEngine.homeostaticPause = data.homeostaticPause;
		CalcWorkerEngine.framesPerMillisecond = (1000 / data.fps) | 0;
		CalcWorkerEngine.iterationsPerMillisecond = Math.max(data.iterationsPerSecond, 1) / 1000;

		if (CalcWorkerEngine.tableSizeX !== data.tableSizeX) {
			CalcWorkerEngine.tableSizeAltered = true;
		}

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
		let calcCount: number = 0,
			calcCountTotal: number = 0,
			calcIterations: number = 0,
			calcTimestampFPSThen: number = performance.now() | 0,
			calcTimestampIPSDelta: number = 0,
			calcTimestampIPSThen: number = calcTimestampFPSThen,
			calcTimestampThen: number = 0,
			cellMeta: CellMeta,
			countAlive: number = 0,
			countDead: number = 0,
			data: Map<number, CellMeta> = new Map<number, CellMeta>(),
			dataNew: boolean,
			life: Uint32Array[] = CalcWorkerEngine.life,
			homeostatic: boolean,
			homeostaticDataMax: number = 40, // is enough to catch a 20 period oscillation
			homeostaticData: any[] = new Array(homeostaticDataMax),
			homeostaticDataIndex: number = 0,
			positions: Uint32Array,
			spinOut: boolean = false,
			statHomeostasisAvg: Stat = CalcWorkerEngine.stats[Stats.CALC_HOMEOSTASIS_AVG],
			statNeighborAvg: Stat = CalcWorkerEngine.stats[Stats.CALC_NEIGHBORS_AVG],
			statStatAvg: Stat = CalcWorkerEngine.stats[Stats.CALC_STATE_AVG],
			tableSizeX: number = CalcWorkerEngine.tableSizeX,
			tableSizeY: number = CalcWorkerEngine.tableSizeY,
			x: number,
			xMax: number,
			xShifted: number,
			xShiftedPlus1: number,
			xShiftedSub1: number,
			xy: number,
			y: number,
			yMax: number,
			yPlus1: number,
			ySub1: number;

		const { xMask, xShifted1, xyMask, xyValueAlive, xyValueDead, yMask } = masks;
		const dataTransform: () => Uint32Array = () => {
			const array: number[] = [];

			for ([xy, cellMeta] of data) {
				if (cellMeta.alive !== 0 || cellMeta.dead !== 0) {
					array.push(xy | cellMeta.alive | cellMeta.dead);
				}
			}

			// CtV Bus initial timestamp
			array.push(new Date().getTime() & 0x7fffffff);

			return Uint32Array.from(array);
		};

		for (x = 0; x < homeostaticDataMax; x++) {
			homeostaticData[x] = {
				alive: x,
				dead: x,
			};
		}

		const calc = (timestampNow: number) => {
			// Start the request for the next frame
			CalcWorkerEngine.calcRequest = requestAnimationFrame(calc);
			timestampNow |= 0;

			/**
			 * Reset
			 */
			if (CalcWorkerEngine.reset) {
				CalcWorkerEngine.reset = false;
				CalcWorkerEngine.play = false;

				calcCount = 0;
				calcCountTotal = 0;
				homeostatic = false;
				spinOut = false;

				for (x = 0; x < tableSizeX; x++) {
					for (y = 0; y < tableSizeY; y++) {
						xy = (x << xyWidthBits) | y;

						cellMeta = <any>data.get(xy);
						if (cellMeta) {
							cellMeta.alive = 0;
							cellMeta.dead = 0;
							cellMeta.neighbors = 0;
						} else {
							data.set(xy, {
								alive: 0,
								dead: 0,
								neighbors: 0,
							});
						}
					}
				}

				calcTimestampFPSThen = timestampNow;
				calcTimestampIPSThen = timestampNow;
				calcTimestampThen = timestampNow;
				return;
			}

			/**
			 * Gameboard
			 */
			if (CalcWorkerEngine.tableSizeAltered) {
				CalcWorkerEngine.tableSizeAltered = false;

				if (tableSizeX < CalcWorkerEngine.tableSizeX) {
					// Grow
					tableSizeX = CalcWorkerEngine.tableSizeX;
					tableSizeY = CalcWorkerEngine.tableSizeY;

					for (x = 0; x < tableSizeX; x++) {
						for (y = 0; y < tableSizeY; y++) {
							xy = (x << xyWidthBits) | y;

							!data.has(xy) &&
								data.set(xy, {
									alive: 0,
									dead: 0,
									neighbors: 0,
								});
						}
					}
				} else {
					// Shrink
					tableSizeX = CalcWorkerEngine.tableSizeX;
					tableSizeY = CalcWorkerEngine.tableSizeY;
					for (xy of data.keys()) {
						y = xy & yMask;
						if (y >= tableSizeY) {
							data.delete(xy);
						} else {
							x = (xy >> xyWidthBits) & yMask;
							if (x >= tableSizeX) {
								data.delete(xy);
							}
						}
					}
				}

				if (!CalcWorkerEngine.play) {
					// Post postions
					positions = dataTransform();
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
			}

			/**
			 * Life: manually added by user
			 */
			if (life.length) {
				while (life.length) {
					positions = <Uint32Array>life.pop();

					for (xy of positions) {
						cellMeta = <any>data.get(xy & xyMask);
						cellMeta.alive = xy & xyValueAlive;
						cellMeta.dead = xy & xyValueDead;
						cellMeta.neighbors = 0;
					}
				}

				if (!CalcWorkerEngine.play) {
					// Post postions
					positions = dataTransform();
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
			}

			/**
			 * Play/Pause
			 */
			if (!CalcWorkerEngine.play) {
				calcCount = 0;
				calcTimestampFPSThen = timestampNow;
				calcTimestampIPSThen = timestampNow;
				calcTimestampThen = timestampNow;
				homeostatic = false;
				spinOut = false;
				return;
			}

			/**
			 * timestampNow is based on ms
			 */
			calcIterations = ((timestampNow - calcTimestampThen) * CalcWorkerEngine.iterationsPerMillisecond) | 0;
			if (calcIterations !== 0 && !spinOut) {
				calcTimestampThen = timestampNow;
				dataNew = true;

				// Metrics
				calcCount += calcIterations;
				calcCountTotal += calcIterations;

				// Config
				xMax = tableSizeX - 1;
				yMax = tableSizeY - 1;

				// Calc: Neighbors
				while (calcIterations !== 0) {
					calcIterations--;

					if (CalcWorkerEngine.reset || !CalcWorkerEngine.play) {
						break;
					}

					if (CalcWorkerEngine.cpuSpinOutProtection && performance.now() - timestampNow > 2000) {
						spinOut = true;
						CalcWorkerEngine.post([
							{
								cmd: CalcBusOutputCmd.SPIN_OUT,
								data: undefined,
							},
						]);
						CalcWorkerEngine.inputPause();
						break;
					}

					/**
					 * Neighbors (living cells only)
					 *
					 * Consider: Diagonals, Horizontal, and Veritical cells
					 */
					statNeighborAvg.watchStart();
					for ([xy, cellMeta] of data) {
						if (cellMeta.alive === 0) {
							continue;
						}

						// Decode x & y
						xShifted = xy & xMask;
						x = xShifted >> xyWidthBits;
						y = xy & yMask;

						// Neighbors: Middle
						if (y !== yMax) {
							// Neighbors: Above
							yPlus1 = y + 1;
							(<any>data.get(xShifted | yPlus1)).neighbors++;
						} else {
							yPlus1 = 0;
						}

						if (y !== 0) {
							// Neighbors: Below
							ySub1 = y - 1;
							(<any>data.get(xShifted | ySub1)).neighbors++;
						} else {
							ySub1 = 0;
						}

						// Neighbors: Left
						if (x !== 0) {
							xShiftedSub1 = xShifted - xShifted1;

							// Neighbors: Above
							yPlus1 !== 0 && (<any>data.get(xShiftedSub1 | yPlus1)).neighbors++;

							// Neighbors: Middle
							(<any>data.get(xShiftedSub1 | y)).neighbors++;

							// Neighbors: Below
							ySub1 !== 0 && (<any>data.get(xShiftedSub1 | ySub1)).neighbors++;
						}

						// Neighbors: Right
						if (x !== xMax) {
							xShiftedPlus1 = xShifted + xShifted1;

							// Neighbors: Above
							yPlus1 !== 0 && (<any>data.get(xShiftedPlus1 | yPlus1)).neighbors++;

							// Neighbors: Middle
							(<any>data.get(xShiftedPlus1 | y)).neighbors++;

							// Neighbors: Below
							ySub1 !== 0 && (<any>data.get(xShiftedPlus1 | ySub1)).neighbors++;
						}
					}
					statNeighborAvg.watchStop();

					/**
					 * Calc: State (reset neighbor count while iterating)
					 *
					 * 1. Any live cell with fewer than two live neighbors		- Dies (underpopulation)
					 * 2. Any live cell with two or three live neighbors		- Stays alive
					 * 3. Any live cell with more than three live neighbors		- Dies (overpopulation)
					 * 4. Any dead cell with exactly three live neighbors		- Becomes alive (reproduction)
					 */
					statStatAvg.watchStart();
					countAlive = 0;
					countDead = 0;
					for (cellMeta of data.values()) {
						if (cellMeta.alive !== 0) {
							if (cellMeta.neighbors === 2 || cellMeta.neighbors === 3) {
								// Rule 2
								countAlive++;
							} else {
								// Rule 1 & Rule 3
								cellMeta.alive = 0;
								cellMeta.dead = xyValueDead;
								countDead++;
							}
						} else if (cellMeta.neighbors === 3) {
							// Rule 4
							cellMeta.alive = xyValueAlive;
							cellMeta.dead = 0;
							countAlive++;
						} else if (cellMeta.dead !== 0) {
							countDead++;
						}

						cellMeta.neighbors = 0;
					}
					statStatAvg.watchStop();

					// Homeostasis
					if (!homeostatic) {
						statHomeostasisAvg.watchStart();
						homeostaticData[homeostaticDataIndex].alive = countAlive;
						homeostaticData[homeostaticDataIndex].dead = countDead;
						homeostaticDataIndex = (homeostaticDataIndex + 1) % homeostaticDataMax;

						// Find a matching oscillation period within the first half of the dataset
						xy = (homeostaticDataMax / 2) | 0;
						for (y = 1; y < xy; y++) {
							if (
								homeostaticData[0].alive === homeostaticData[y].alive ||
								homeostaticData[0].dead === homeostaticData[y].dead
							) {
								break;
							}
						}

						// Check dataset to see if the period repeats
						for (x = 0; x < homeostaticDataMax - y; x++) {
							if (
								homeostaticData[x].alive !== homeostaticData[x + y].alive ||
								homeostaticData[x].dead !== homeostaticData[x + y].dead
							) {
								break;
							}
						}
						statHomeostasisAvg.watchStop();

						if (x === homeostaticDataMax - y) {
							homeostatic = true;

							// Post
							CalcWorkerEngine.post([
								{
									cmd: CalcBusOutputCmd.HOMEOSTATIC,
									data: undefined,
								},
							]);

							if (CalcWorkerEngine.homeostaticPause) {
								CalcWorkerEngine.play = false;

								// Post postions
								positions = dataTransform();
								CalcWorkerEngine.post(
									[
										{
											cmd: CalcBusOutputCmd.POSITIONS,
											data: positions,
										},
									],
									[positions.buffer],
								);

								// Post stats
								CalcWorkerEngine.post([
									{
										cmd: CalcBusOutputCmd.STATS,
										data: {
											alive: countAlive,
											dead: countDead,
											ips: calcCount,
											ipsDeltaInMS: calcTimestampIPSDelta,
											ipsTotal: calcCountTotal - homeostaticDataMax,
											performance: CalcWorkerEngine.stats,
										},
									},
								]);
								calcCount = 0;
								return;
							}
						}
					}

					if (countAlive === 0) {
						CalcWorkerEngine.play = false;

						// Post game over
						CalcWorkerEngine.post([
							{
								cmd: CalcBusOutputCmd.GAME_OVER,
								data: data.size,
							},
						]);

						// Post postions
						positions = dataTransform();
						CalcWorkerEngine.post(
							[
								{
									cmd: CalcBusOutputCmd.POSITIONS,
									data: positions,
								},
							],
							[positions.buffer],
						);

						// Post stats
						CalcWorkerEngine.post([
							{
								cmd: CalcBusOutputCmd.STATS,
								data: {
									alive: countAlive,
									dead: countDead,
									ips: calcCount,
									ipsDeltaInMS: calcTimestampIPSDelta,
									ipsTotal: calcCountTotal,
									performance: CalcWorkerEngine.stats,
								},
							},
						]);
						calcCount = 0;
						calcCountTotal = 0;
						return;
					}
				}
			}

			/**
			 * Send data to video thread at FPS rate (if required)
			 */
			if (dataNew && timestampNow - calcTimestampFPSThen > CalcWorkerEngine.framesPerMillisecond) {
				calcTimestampFPSThen = timestampNow;
				dataNew = false;

				// Post postions
				positions = dataTransform();
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
						cmd: CalcBusOutputCmd.STATS,
						data: {
							alive: countAlive,
							dead: countDead,
							ips: calcCount,
							ipsDeltaInMS: calcTimestampIPSDelta,
							ipsTotal: calcCountTotal,
							performance: CalcWorkerEngine.stats,
						},
					},
				]);
				calcCount = 0;
				calcTimestampIPSThen = timestampNow;
			}
		};
		CalcWorkerEngine.calc = calc;
	}
}
