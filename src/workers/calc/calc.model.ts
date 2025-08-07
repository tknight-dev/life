import { VideoBusInputDataSettingsFPS } from '../video/video.model';

/**
 * @author tknight-dev
 */

/*
 * Masks
 */
export const masks = {
	xMask: 0,
	xShifted1: 0,
	xyMask: 0,
	xyValueAlive: 0,
	xyValueDead: 0,
	yMask: 0,
};
export const xyWidthBits: number = 11;

masks.xMask = (Math.pow(2, xyWidthBits) - 1) << xyWidthBits;
masks.xShifted1 = 0x1 << xyWidthBits;
masks.xyMask = ((Math.pow(2, xyWidthBits) - 1) << xyWidthBits) | (Math.pow(2, xyWidthBits) - 1);
masks.xyValueAlive = 0x1 << (xyWidthBits * 2);
masks.xyValueDead = 0x1 << (xyWidthBits * 2 + 1);
masks.yMask = Math.pow(2, xyWidthBits) - 1;

/*
 * Stats
 */

export enum Stats {
	CALC_AVG = 0,
	CALC_HOMEOSTASIS_AVG = 1,
	CALC_NEIGHBORS_AVG = 2,
	CALC_STATE_AVG = 3,
	CALC_TO_VIDEO_BUS_AVG = 4,
	VIDEO_DRAW_AVG = 5,
}

export class Stat {
	public data: number[];
	public index: number;
	public samples: number;
	public size: number;
	public timer: number;

	constructor(samples: number = 5) {
		this.data = new Array(samples);
		this.index = 0;
		this.samples = samples;
		this.size = 0;
	}

	public add(value: number): void {
		this.data[this.index++] = value;

		if (this.index !== 0 && this.index % this.samples === 0) {
			this.index = 0;
			this.size = this.samples;
		} else {
			this.size++;
		}
	}

	/**
	 * @return 0 on no data available
	 */
	public static getAVG(stat: Stat): number {
		const data: number[] = stat.data,
			size: number = Math.min(stat.samples, stat.size);

		if (size === 0) {
			return 0;
		}

		let value: number = 0;

		for (let i = 0; i < size; i++) {
			value += data[i];
		}

		return value / size;
	}

	public watchStart(): void {
		this.timer = performance.now();
	}

	public watchStop(): void {
		this.add(performance.now() - this.timer);
	}
}

/*
 * Inputs
 */

export enum CalcBusInputCmd {
	INIT,
	LIFE,
	PLAY,
	PAUSE,
	RESET,
	SETTINGS,
}

export interface CalcBusInputDataInit extends CalcBusInputDataSettings {
	life: Uint32Array;
}

export interface CalcBusInputDataSettings {
	cpuSpinOutProtection: boolean;
	homeostaticPause: boolean;
	fps: VideoBusInputDataSettingsFPS;
	iterationsPerSecond: number;
	tableSizeX: 48 | 112 | 240 | 496 | 1008 | 2032;
}

export interface CalcBusInputPayload {
	cmd: CalcBusInputCmd;
	data: CalcBusInputDataInit | Uint32Array | undefined;
}

/*
 * Outputs
 */

export enum CalcBusOutputCmd {
	GAME_OVER,
	HOMEOSTATIC,
	INIT_COMPLETE,
	POSITIONS,
	SPIN_OUT,
	STATS,
}

export interface CalcBusOutputDataStats {
	alive: number;
	dead: number;
	ips: number;
	ipsDeltaInMS: number;
	ipsTotal: number;
	performance: { [key: number]: Stat };
}

export interface CalcBusOutputPayload {
	cmd: CalcBusOutputCmd;
	data: CalcBusOutputDataStats | number | Uint32Array | undefined;
}
