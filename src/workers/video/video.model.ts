/**
 * @author tknight-dev
 */

/*
 * Inputs
 */

export enum VideoBusInputCmd {
	INIT,
	RESIZE,
	SETTINGS,
}

export interface VideoBusInputDataInit extends VideoBusInputDataResize, VideoBusInputDataSettings {
	canvasOffscreen: OffscreenCanvas;
}

export interface VideoBusInputDataResize {
	devicePixelRatio: number; // precision 1
	force?: boolean;
	height: number;
	scaler: number;
	width: number;
}

export interface VideoBusInputDataSettings {
	fps: VideoBusInputDataSettingsFPS;
	grid: boolean;
	resolution: null | 256 | 384 | 512 | 640 | 1280 | 1920;
	tableSizeX: 48 | 112 | 240 | 496 | 1008 | 2032 | 8176 | 16368 | 32752;
}

export enum VideoBusInputDataSettingsFPS {
	_30 = 30,
	_40 = 40,
	_60 = 60,
	_120 = 120,
	_UNLIMITED = 1,
}

export interface VideoBusInputPayload {
	cmd: VideoBusInputCmd;
	data: VideoBusInputDataInit | VideoBusInputDataResize | VideoBusInputDataSettings | undefined;
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
	data: number | undefined;
}
