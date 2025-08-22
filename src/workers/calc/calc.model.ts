import { VideoBusInputDataSettingsFPS } from '../video/video.model';
import { GamingCanvasStat } from '@tknight-dev/gaming-canvas';

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
export const xyWidthBits: number = 12;

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
	CALC_BUS_AVG = 1,
	CALC_HOMEOSTASIS_AVG = 2,
	CALC_NEIGHBORS_AVG = 3,
	CALC_STATE_AVG = 4,
	CALC_TO_VIDEO_BUS_AVG = 5,
	VIDEO_DRAW_AVG = 6,
}

/*
 * Util
 */
export const scale = (v: number, a: number, b: number, y: number, z: number) => {
	return ((v - a) * (z - y)) / (b - a) + y;
};

export const scalePx = (cameraZoom: number, tableSizeX: number) => scale(cameraZoom, 1, 100, 1, scale(tableSizeX, 48, 2560, 2, 35));

/*
 * Inputs
 */

export enum CalcBusInputCmd {
	INIT,
	LIFE,
	PLAY,
	PAUSE,
	RESET,
	RESTORE,
	SAVE,
	SETTINGS,
}

export interface CalcBusInputDataInit extends CalcBusInputDataSettings {
	life: Uint32Array;
}

export interface CalcBusInputDataSettings {
	cpuSpinOutProtection: boolean;
	debug: boolean;
	homeostaticPause: boolean;
	fps: VideoBusInputDataSettingsFPS;
	iterationsPerSecond: number;
	tableSizeX: 32 | 80 | 160 | 320 | 640 | 960 | 1280 | 1920 | 2560;
}

export interface CalcBusInputPayload {
	cmd: CalcBusInputCmd;
	data: CalcBusInputDataInit | CalcBusOutputDataSave | Uint32Array | undefined;
}

/*
 * Outputs
 */

export enum CalcBusOutputCmd {
	GAME_OVER,
	HOMEOSTATIC,
	INIT_COMPLETE,
	POSITIONS,
	SAVE,
	SPIN_OUT,
	STATS,
}

export interface CalcBusOutputDataPositions {
	alive: Uint32Array;
	deadMode: boolean;
	deadOrNone: Uint32Array;
	timestamp: number;
}

export interface CalcBusOutputDataSave {
	alive: Uint32Array;
	dead: Uint32Array;
	ipsTotal: number;
	tableSizeX: number;
}

export interface CalcBusOutputDataStats {
	alive: number;
	dead: number;
	ips: number;
	ipsDeltaInMS: number;
	ipsTotal: number;
	performance: { [key: number]: GamingCanvasStat };
}

export interface CalcBusOutputPayload {
	cmd: CalcBusOutputCmd;
	data: CalcBusOutputDataPositions | CalcBusOutputDataSave | CalcBusOutputDataStats | number | Uint32Array | undefined;
}
