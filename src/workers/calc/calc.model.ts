import { VideoBusInputDataSettingsFPS } from '../video/video.model';

/**
 * @author tknight-dev
 */

/*
 * Inputs
 */

export enum CalcBusInputCmd {
	INIT,
	SETTINGS,
}

export interface CalcBusInputDataInit extends CalcBusInputDataSettings {}

export interface CalcBusInputDataSettings {
	fps: VideoBusInputDataSettingsFPS;
	iterationsPerSecond: number;
}

export interface CalcBusInputPayload {
	cmd: CalcBusInputCmd;
	data: CalcBusInputDataInit | undefined;
}

/*
 * Outputs
 */

export enum CalcBusOutputCmd {
	INIT_COMPLETE,
	IPS,
}

export interface CalcBusOutputDataIPS {
	ips: number;
	ipsTotal: number;
}

export interface CalcBusOutputPayload {
	cmd: CalcBusOutputCmd;
	data: CalcBusOutputDataIPS | undefined;
}
