import {
	CalcBusInputCmd,
	CalcBusInputDataInit,
	CalcBusInputDataSettings,
	CalcBusInputPayload,
	CalcBusOutputCmd,
	CalcBusOutputDataPositions,
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

const { xMask, xShifted1, xyMask, xyValueAlive, xyValueDead, yMask } = masks;

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
	alive: boolean;
	dead: boolean;
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
	private static tableSizeX: 32 | 80 | 160 | 320 | 640 | 960 | 1280 | 1920 | 2560;
	private static tableSizeY: number;

	public static async initialize(self: Window & typeof globalThis, data: CalcBusInputDataInit): Promise<void> {
		// Config
		CalcWorkerEngine.self = self;

		// Engines
		CalcWorkerEngine.inputLife(data.life);
		CalcWorkerEngine.inputSettings(data);

		// Stats
		CalcWorkerEngine.stats[Stats.CALC_AVG] = new Stat();
		CalcWorkerEngine.stats[Stats.CALC_BUS_AVG] = new Stat();
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

	private static post(CalcBusWorkerPayloads: CalcBusOutputPayload[], data: Transferable[] = []): void {
		CalcWorkerEngine.self.postMessage(
			{
				payloads: CalcBusWorkerPayloads,
			},
			<any>data,
		);
	}

	private static calc(_: number): void {}

	/**
	 * Performance Tweaks: Failure Logs
	 * 	-	Arrays (dataAlive, dataDead, etc) are 2x faster then Sets
	 * 	-	Maps are better then Objects in high IO contexts
	 */
	private static calcBinder(): void {
		let calcCount: number = 0,
			calcCountTotal: number = 0,
			calcIterations: number = 0,
			calcTimestampFPSThen: number = performance.now() | 0,
			calcTimestampIPSDelta: number = 0,
			calcTimestampIPSThen: number = calcTimestampFPSThen,
			calcTimestampThen: number = 0,
			cellMeta: CellMeta,
			data: Map<number, CellMeta> = new Map<number, CellMeta>(),
			dataAlive: number[] = [],
			dataAliveIndex: number = 0,
			dataDead: number[] = [],
			dataDeadIndex: number = 0,
			dataNone: number[] = [],
			dataNoneIndex: number = 0,
			dataNew: boolean,
			i: number,
			life: Uint32Array[] = CalcWorkerEngine.life,
			homeostatic: boolean,
			homeostaticDataMax: number = 40, // is enough to catch a 20 period oscillation
			homeostaticData: any[] = [...new Array(homeostaticDataMax)].map((_, i) => {
				return { alive: i, dead: i };
			}),
			homeostaticDataIndex: number = 0,
			positions: Uint32Array,
			spinOut: boolean = false,
			statCalcAvg: Stat = CalcWorkerEngine.stats[Stats.CALC_AVG],
			statBusAvg: Stat = CalcWorkerEngine.stats[Stats.CALC_BUS_AVG],
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

		const arrayExpand = (array: number[], size: number) => {
			try {
				Array.prototype.push.apply(array, new Array(size));
			} catch (error) {
				let reducer: number = Math.round(size / 2);

				for (; size > 0; size -= reducer) {
					arrayExpand(array, Math.min(reducer, size));
				}
			}
		};
		const dataPost: () => void = () => {
			statBusAvg.watchStart();
			const deadMode: boolean = dataNoneIndex > dataDeadIndex, // Send the smaller of the 2 possible arrays
				ret: CalcBusOutputDataPositions = {
					alive: Uint32Array.from(dataAlive.slice(0, dataAliveIndex)),
					deadMode: deadMode,
					deadOrNone: Uint32Array.from(deadMode ? dataDead.slice(0, dataDeadIndex) : dataNone.slice(0, dataNoneIndex)),
					timestamp: new Date().getTime(),
				};
			statBusAvg.watchStop();

			CalcWorkerEngine.post(
				[
					{
						cmd: CalcBusOutputCmd.POSITIONS,
						data: ret,
					},
				],
				[ret.alive.buffer, ret.deadOrNone.buffer],
			);
		};

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

				if (dataAlive.length < tableSizeX * tableSizeY) {
					arrayExpand(dataAlive, tableSizeX * tableSizeY - dataAlive.length);
					arrayExpand(dataDead, tableSizeX * tableSizeY - dataDead.length);
					arrayExpand(dataNone, tableSizeX * tableSizeY - dataNone.length);
				}

				dataAliveIndex = 0;
				dataDeadIndex = 0;
				dataNoneIndex = 0;
				for (x = 0; x < tableSizeX; x++) {
					for (y = 0; y < tableSizeY; y++) {
						xy = (x << xyWidthBits) | y;

						cellMeta = <CellMeta>data.get(xy);
						dataNone[dataNoneIndex++] = xy;
						if (cellMeta) {
							cellMeta.alive = false;
							cellMeta.dead = false;
							cellMeta.neighbors = 0;
						} else {
							data.set(xy, {
								alive: false,
								dead: false,
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
					tableSizeX = CalcWorkerEngine.tableSizeX;
					tableSizeY = CalcWorkerEngine.tableSizeY;

					// Grow
					if (dataAlive.length < tableSizeX * tableSizeY) {
						arrayExpand(dataAlive, tableSizeX * tableSizeY - dataAlive.length);
						arrayExpand(dataDead, tableSizeX * tableSizeY - dataDead.length);
						arrayExpand(dataNone, tableSizeX * tableSizeY - dataNone.length);
					}

					for (x = 0; x < tableSizeX; x++) {
						for (y = 0; y < tableSizeY; y++) {
							xy = (x << xyWidthBits) | y;

							// Checking has() is the same performance as x & y range checks (x >= tableSizeX ... etc)
							if (!data.has(xy)) {
								data.set(xy, {
									alive: false,
									dead: false,
									neighbors: 0,
								});
								dataNone[dataNoneIndex++] = xy;
							}
						}
					}
				} else {
					// Shrink
					dataAliveIndex = 0;
					dataDeadIndex = 0;
					dataNoneIndex = 0;
					tableSizeX = CalcWorkerEngine.tableSizeX;
					tableSizeY = CalcWorkerEngine.tableSizeY;

					for ([xy, cellMeta] of data) {
						y = xy & yMask;
						if (y >= tableSizeY) {
							data.delete(xy);
						} else {
							x = (xy >> xyWidthBits) & yMask;
							if (x >= tableSizeX) {
								data.delete(xy);
							} else {
								if (cellMeta.alive) {
									dataAlive[dataAliveIndex++] = xy;
								} else if (cellMeta.dead) {
									dataDead[dataDeadIndex++] = xy;
								} else {
									dataNone[dataNoneIndex++] = xy;
								}
							}
						}
					}
				}

				if (!CalcWorkerEngine.play) {
					// Post postions
					dataPost();
				}
			}

			/**
			 * Life: manually added by user
			 */
			if (life.length) {
				while (life.length) {
					positions = <Uint32Array>life.pop();

					for (xy of positions) {
						i = xy & xyMask;

						cellMeta = <CellMeta>data.get(i);
						cellMeta.alive = (xy & xyValueAlive) !== 0;
						cellMeta.dead = (xy & xyValueDead) !== 0;
						cellMeta.neighbors = 0;
					}
				}

				dataAliveIndex = 0;
				dataDeadIndex = 0;
				dataNoneIndex = 0;
				for ([xy, cellMeta] of data) {
					if (cellMeta.alive) {
						dataAlive[dataAliveIndex++] = xy;
					} else if (cellMeta.dead) {
						dataDead[dataDeadIndex++] = xy;
					} else {
						dataNone[dataNoneIndex++] = xy;
					}
				}

				if (!CalcWorkerEngine.play) {
					// Post postions
					dataPost();
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

				// Calc
				statCalcAvg.watchStart();
				while (calcIterations !== 0) {
					calcIterations--;

					if (CalcWorkerEngine.reset || !CalcWorkerEngine.play) {
						break;
					}

					if (CalcWorkerEngine.cpuSpinOutProtection && performance.now() - timestampNow > 1500) {
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
					 * Calc: Neighbors (living cells only)
					 *
					 * Consider: Diagonals, Horizontal, and Veritical cells
					 */
					statNeighborAvg.watchStart();
					for (i = 0; i < dataAliveIndex; i++) {
						xy = dataAlive[i];
						cellMeta = <CellMeta>data.get(xy);

						// Decode x & y
						xShifted = xy & xMask;
						x = xShifted >> xyWidthBits;
						y = xy & yMask;

						// Neighbors: Middle
						if (y !== yMax) {
							// Neighbors: Above
							yPlus1 = y + 1;
							(<CellMeta>data.get(xShifted | yPlus1)).neighbors++;
						} else {
							yPlus1 = 0;
						}

						if (y !== 0) {
							// Neighbors: Below
							ySub1 = y - 1;
							(<CellMeta>data.get(xShifted | ySub1)).neighbors++;
						} else {
							ySub1 = 0;
						}

						// Neighbors: Left
						if (x !== 0) {
							xShiftedSub1 = xShifted - xShifted1;

							// Neighbors: Above
							yPlus1 !== 0 && (<CellMeta>data.get(xShiftedSub1 | yPlus1)).neighbors++;

							// Neighbors: Middle
							(<CellMeta>data.get(xShiftedSub1 | y)).neighbors++;

							// Neighbors: Below
							ySub1 !== 0 && (<CellMeta>data.get(xShiftedSub1 | ySub1)).neighbors++;
						}

						// Neighbors: Right
						if (x !== xMax) {
							xShiftedPlus1 = xShifted + xShifted1;

							// Neighbors: Above
							yPlus1 !== 0 && (<CellMeta>data.get(xShiftedPlus1 | yPlus1)).neighbors++;

							// Neighbors: Middle
							(<CellMeta>data.get(xShiftedPlus1 | y)).neighbors++;

							// Neighbors: Below
							ySub1 !== 0 && (<CellMeta>data.get(xShiftedPlus1 | ySub1)).neighbors++;
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
					dataAliveIndex = 0;
					dataDeadIndex = 0;
					dataNoneIndex = 0;
					for ([xy, cellMeta] of data) {
						if (cellMeta.alive) {
							if (cellMeta.neighbors === 2 || cellMeta.neighbors === 3) {
								// Rule 2
								dataAlive[dataAliveIndex++] = xy;
							} else {
								// Rule 1 & Rule 3
								cellMeta.alive = false;
								cellMeta.dead = true;
								dataDead[dataDeadIndex++] = xy;
							}
						} else if (cellMeta.neighbors === 3) {
							// Rule 4
							cellMeta.alive = true;
							cellMeta.dead = false;
							dataAlive[dataAliveIndex++] = xy;
						} else if (cellMeta.dead) {
							dataDead[dataDeadIndex++] = xy;
						} else {
							dataNone[dataNoneIndex++] = xy;
						}

						cellMeta.neighbors = 0;
					}
					statStatAvg.watchStop();

					// Homeostasis
					if (!homeostatic) {
						statHomeostasisAvg.watchStart();
						homeostaticData[homeostaticDataIndex].alive = dataAliveIndex;
						homeostaticData[homeostaticDataIndex].dead = dataDeadIndex;
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
								dataPost();

								// Post stats
								CalcWorkerEngine.post([
									{
										cmd: CalcBusOutputCmd.STATS,
										data: {
											alive: dataAliveIndex,
											dead: dataDeadIndex,
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

					if (dataAliveIndex === 0) {
						CalcWorkerEngine.play = false;

						// Post game over
						CalcWorkerEngine.post([
							{
								cmd: CalcBusOutputCmd.GAME_OVER,
								data: data.size,
							},
						]);

						// Post postions
						dataPost();

						// Post stats
						CalcWorkerEngine.post([
							{
								cmd: CalcBusOutputCmd.STATS,
								data: {
									alive: dataAliveIndex,
									dead: dataDeadIndex,
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
				statCalcAvg.watchStop();
			}

			/**
			 * Send data to video thread at FPS rate (if required)
			 */
			if (dataNew && timestampNow - calcTimestampFPSThen > CalcWorkerEngine.framesPerMillisecond) {
				calcTimestampFPSThen = timestampNow;
				dataNew = false;

				// Post postions
				dataPost();
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
							alive: dataAliveIndex,
							dead: dataDeadIndex,
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
