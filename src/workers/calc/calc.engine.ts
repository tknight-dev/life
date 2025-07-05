import { CalcBusInputCmd, CalcBusInputDataInit, CalcBusInputPayload, CalcBusOutputCmd, CalcBusOutputPayload } from './calc.model';

/**
 * @author tknight-dev
 */

self.onmessage = (event: MessageEvent) => {
	const videoBusInputPayload: CalcBusInputPayload = event.data;

	switch (videoBusInputPayload.cmd) {
		case CalcBusInputCmd.INIT:
			CalcWorkerEngine.initialize(self, <CalcBusInputDataInit>videoBusInputPayload.data);
			break;
	}
};

class CalcWorkerEngine {
	private static self: Window & typeof globalThis;

	public static async initialize(self: Window & typeof globalThis, data: CalcBusInputDataInit): Promise<void> {
		CalcWorkerEngine.self = self;

		CalcWorkerEngine.post([
			{
				cmd: CalcBusOutputCmd.INIT_COMPLETE,
				data: undefined,
			},
		]);
	}

	private static post(CalcBusWorkerPayloads: CalcBusOutputPayload[]): void {
		CalcWorkerEngine.self.postMessage({
			payloads: CalcBusWorkerPayloads,
		});
	}
}
