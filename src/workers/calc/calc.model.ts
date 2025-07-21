import { VideoBusInputDataSettingsFPS } from '../video/video.model';

/**
 * @author tknight-dev
 */

/*
 * Masks
 */
export const masks = {
	xMask: 0,
	xMask1: 0,
	xyMask: 0,
	xyMaskAlive: 0,
	xyMaskDead: 0,
	yMask: 0,
};
export const xyWidthBits: number = 11;

masks.xMask = (Math.pow(2, xyWidthBits) - 1) << xyWidthBits;
masks.xMask1 = 0x1 << xyWidthBits;
masks.xyMask = ((Math.pow(2, xyWidthBits) - 1) << xyWidthBits) | (Math.pow(2, xyWidthBits) - 1);
masks.xyMaskAlive = 0x1 << (xyWidthBits * 2);
masks.xyMaskDead = 0x1 << (xyWidthBits * 2 + 1);
masks.yMask = Math.pow(2, xyWidthBits) - 1;

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
	INIT_COMPLETE,
	PS,
	POSITIONS,
	SPIN_OUT,
}

export interface CalcBusOutputDataPS {
	alive: number;
	dead: number;
	ips: number;
	ipsDeltaInMS: number;
	ipsTotal: number;
}

export interface CalcBusOutputPayload {
	cmd: CalcBusOutputCmd;
	data: CalcBusOutputDataPS | number | Uint32Array | undefined;
}
