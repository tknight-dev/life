/**
 * @author tknight-dev
 */

/*
 * Inputs
 */

export enum VideoBusInputCmd {
	DATA,
	INIT,
	RESIZE,
	SETTINGS,
}

export interface VideoBusInputDataInit extends VideoBusInputDataResize, VideoBusInputDataSettings {
	canvasOffscreen: OffscreenCanvas;
	life: Uint32Array;
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
	data: VideoBusInputDataInit | VideoBusInputDataResize | VideoBusInputDataSettings | Uint32Array | undefined;
}

/*
 * Outputs
 */

export enum VideoBusOutputCmd {
	FPS,
	INIT_COMPLETE,
}

export interface VideoBusOutputPayload {
	cmd: VideoBusOutputCmd;
	data: boolean | number | undefined;
}
