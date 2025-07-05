/**
 * @author tknight-dev
 */

/*
 * Inputs
 */

export enum CalcBusInputCmd {
	INIT,
}

export interface CalcBusInputDataInit {}

export interface CalcBusInputPayload {
	cmd: CalcBusInputCmd;
	data: CalcBusInputDataInit | undefined;
}

/*
 * Outputs
 */

export enum CalcBusOutputCmd {
	INIT_COMPLETE,
}

export interface CalcBusOutputPayload {
	cmd: CalcBusOutputCmd;
	data: undefined;
}
