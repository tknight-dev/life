import { CalcBusOutputDataPositions, Stat } from '../calc/calc.model';

/**
 * @author tknight-dev
 */

/*
 * Inputs
 */

export enum VideoBusInputCmd {
	DATA,
	INIT,
	RESET,
	RESIZE,
	SETTINGS,
}

export interface VideoBusInputDataInit extends VideoBusInputDataResize, VideoBusInputDataSettings {
	canvasOffscreen: OffscreenCanvas;
}

export interface VideoBusInputDataResize {
	devicePixelRatio: number; // precision 3
	force?: boolean;
	height: number;
	width: number;
}

export interface VideoBusInputDataSettings {
	drawDeadCells: boolean;
	drawGrid: boolean;
	fps: VideoBusInputDataSettingsFPS;
	resolution: null | 256 | 384 | 512 | 640 | 1280 | 1920;
	tableSizeX: 48 | 112 | 240 | 496 | 1008 | 2032;
}

export enum VideoBusInputDataSettingsFPS {
	_30 = 30,
	_40 = 40,
	_60 = 60,
}

export interface VideoBusInputPayload {
	cmd: VideoBusInputCmd;
	data:
		| CalcBusOutputDataPositions
		| boolean
		| VideoBusInputDataInit
		| VideoBusInputDataResize
		| VideoBusInputDataSettings
		| Uint32Array
		| undefined;
}

/*
 * Outputs
 */

export enum VideoBusOutputCmd {
	INIT_COMPLETE,
	RESET_COMPLETE,
	STATS,
}

export interface VideoBusOutputDataStats {
	fps: number;
	performance: { [key: number]: Stat };
}

export interface VideoBusOutputPayload {
	cmd: VideoBusOutputCmd;
	data: boolean | VideoBusOutputDataStats | undefined;
}
