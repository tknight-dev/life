/**
 * @author tknight-dev
 */

/*
 * Inputs
 */

export enum VideoBusInputCmd {
	INIT,
}

export interface VideoBusInputDataInit {
	canvasOffscreen: OffscreenCanvas;
}

export interface VideoBusInputPayload {
	cmd: VideoBusInputCmd;
	data: VideoBusInputDataInit | undefined;
}

/*
 * Outputs
 */

export enum VideoBusOutputCmd {
	INIT_COMPLETE,
}

export interface VideoBusOutputPayload {
	cmd: VideoBusOutputCmd;
	data: undefined;
}
