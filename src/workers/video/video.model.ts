import { CalcBusOutputDataPositions } from '../calc/calc.model';
import { GamingCanvasStat } from '@tknight-dev/gaming-canvas';

/**
 * @author tknight-dev
 */

/*
 * Inputs
 */

export enum VideoBusInputCmd {
	CAMERA,
	DATA,
	INIT,
	RESET,
	RESIZE,
	SETTINGS,
}

export interface VideoBusInputDataInit extends VideoBusInputDataResize, VideoBusInputDataSettings {
	canvasOffscreen: OffscreenCanvas;
}

export interface VideoBusInputDataCamera {
	move: boolean;
	relX: number;
	relY: number;
	zoom: number;
}

export interface VideoBusInputDataResize {
	devicePixelRatio: number;
	height: number;
	width: number;
}

export interface VideoBusInputDataSettings {
	debug: boolean;
	drawDeadCells: boolean;
	drawGrid: boolean;
	fps: VideoBusInputDataSettingsFPS;
	resolution: null | 160 | 320 | 640 | 1280 | 1920 | 2560;
	tableSizeX: 32 | 80 | 160 | 320 | 640 | 960 | 1280 | 1920 | 2560;
}

export enum VideoBusInputDataSettingsFPS {
	_30 = 30,
	_40 = 40,
	_60 = 60,
	_120 = 120,
	_144 = 144,
}

export interface VideoBusInputPayload {
	cmd: VideoBusInputCmd;
	data:
		| CalcBusOutputDataPositions
		| boolean
		| VideoBusInputDataCamera
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
	CAMERA,
	INIT_COMPLETE,
	RESET_COMPLETE,
	STATS,
}

export interface VideoBusOutputDataCamera {
	heightC: number;
	startXC: number;
	startYC: number;
	widthC: number;
}

export interface VideoBusOutputDataStats {
	fps: number;
	performance: { [key: number]: GamingCanvasStat };
}

export interface VideoBusOutputPayload {
	cmd: VideoBusOutputCmd;
	data: boolean | VideoBusOutputDataCamera | VideoBusOutputDataStats | undefined;
}
