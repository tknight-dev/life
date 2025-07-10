import { VideoBusInputDataSettingsFPS } from '../video/video.model';

/**
 * @author tknight-dev
 */

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
	fps: VideoBusInputDataSettingsFPS;
	iterationsPerSecond: number;
	tableSizeX: 48 | 112 | 240 | 496 | 1008 | 2032 | 8176 | 16368 | 32752;
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
